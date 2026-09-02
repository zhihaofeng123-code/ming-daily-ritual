import type {
  AppContractEntity,
  AppContractField,
  AppDataModel,
  AppManifest,
  FieldConfig,
} from "@/lib/app-definition/types";

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const API_PATH_PARAMETER_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const MAX_ENTITIES = 50;
const MAX_FIELDS_PER_ENTITY = 200;
const MAX_FIELD_CONFIG_BYTES = 64 * 1024;
const MAX_FIELD_OPTIONS = 200;
const MAX_FIELD_USERS = 1_000;
const MAX_CONFIG_STRING_CHARS = 256;
const FIELD_TYPES = new Set([
  "text",
  "number",
  "currency",
  "percent",
  "select",
  "multi_select",
  "date",
  "user",
  "multi_user",
  "checkbox",
  "url",
  "email",
  "attachment",
  "relation",
  "json",
]);
const FIELD_CONFIG_KEYS = new Set([
  "options",
  "user_source",
  "users",
  "currency",
  "include_time",
  "date_format",
  "max_visible",
  "relation_entity_id",
  "relation_label_field",
  "attachment",
]);
const DATE_FORMATS = new Set(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "MMM D, YYYY"]);
const API_METHODS = {
  list: "get",
  get: "get",
  create: "post",
  update: "patch",
  delete: "delete",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireSafeIdentifier(value: unknown, label: string): string {
  const text = requireText(value, label);
  if (!SAFE_IDENTIFIER.test(text)) throw new Error(`${label} must be a safe identifier.`);
  return text;
}

function validateOptionalText(value: unknown, label: string): void {
  if (value === undefined) return;
  const text = requireText(value, label).trim();
  if (text.length > MAX_CONFIG_STRING_CHARS) {
    throw new Error(`${label} cannot exceed ${MAX_CONFIG_STRING_CHARS} characters.`);
  }
}

function validateFieldConfig(field: AppContractField, entityId: string): void {
  if (!field.config) return;
  const label = `entity ${entityId} field ${field.id}.config`;
  const config = field.config as FieldConfig & Record<string, unknown>;
  const encoded = JSON.stringify(config);
  if (Buffer.byteLength(encoded, "utf8") > MAX_FIELD_CONFIG_BYTES) {
    throw new Error(`${label} cannot exceed ${MAX_FIELD_CONFIG_BYTES} bytes.`);
  }
  for (const key of Object.keys(config)) {
    if (!FIELD_CONFIG_KEYS.has(key)) throw new Error(`${label}.${key} is unsupported.`);
  }
  if (config.options !== undefined) {
    if (!Array.isArray(config.options)) throw new Error(`${label}.options must be an array.`);
    if (config.options.length > MAX_FIELD_OPTIONS) {
      throw new Error(`${label}.options cannot have more than ${MAX_FIELD_OPTIONS} items.`);
    }
    const optionIds = new Set<string>();
    for (const [index, option] of config.options.entries()) {
      const optionId = requireText(option?.id, `${label}.options[${index}].id`);
      requireText(option?.label, `${label}.options[${index}].label`);
      if (optionIds.has(optionId)) throw new Error(`${label} has duplicate option id ${optionId}.`);
      optionIds.add(optionId);
      validateOptionalText(option?.color, `${label}.options[${index}].color`);
    }
  }
  if (config.users !== undefined) {
    if (!Array.isArray(config.users)) throw new Error(`${label}.users must be an array.`);
    if (config.users.length > MAX_FIELD_USERS) {
      throw new Error(`${label}.users cannot have more than ${MAX_FIELD_USERS} items.`);
    }
    const userIds = new Set<string>();
    for (const [index, user] of config.users.entries()) {
      const userId = requireText(user?.id, `${label}.users[${index}].id`);
      requireText(user?.name, `${label}.users[${index}].name`);
      if (userIds.has(userId)) throw new Error(`${label} has duplicate user id ${userId}.`);
      userIds.add(userId);
      validateOptionalText(user?.email, `${label}.users[${index}].email`);
      validateOptionalText(user?.avatar_url, `${label}.users[${index}].avatar_url`);
    }
  }
  if (config.user_source !== undefined && config.user_source !== "workspace" && config.user_source !== "app") {
    throw new Error(`${label}.user_source must be workspace or app.`);
  }
  if (config.currency !== undefined && !/^[A-Z]{3}$/.test(config.currency)) {
    throw new Error(`${label}.currency must be a 3-letter ISO currency code.`);
  }
  if (config.include_time !== undefined && typeof config.include_time !== "boolean") {
    throw new Error(`${label}.include_time must be a boolean.`);
  }
  if (config.date_format !== undefined && !DATE_FORMATS.has(config.date_format)) {
    throw new Error(`${label}.date_format is unsupported.`);
  }
  if (
    config.max_visible !== undefined &&
    (!Number.isInteger(config.max_visible) || config.max_visible < 1 || config.max_visible > 50)
  ) {
    throw new Error(`${label}.max_visible must be an integer from 1 to 50.`);
  }
  validateOptionalText(config.relation_entity_id, `${label}.relation_entity_id`);
  validateOptionalText(config.relation_label_field, `${label}.relation_label_field`);
}

function apiPath(pathOrConfig: string | { path: string }): string {
  return typeof pathOrConfig === "string" ? pathOrConfig : pathOrConfig.path;
}

function validateApiPath(path: unknown, label: string, recordPath = false): string {
  const text = requireText(path, label);
  if (!text.startsWith("/")) throw new Error(`${label} must be a relative API path.`);
  if (recordPath) {
    const parameters = [...text.matchAll(API_PATH_PARAMETER_PATTERN)];
    if (parameters.length !== 1) {
      throw new Error(`${label} must include exactly one record id path parameter.`);
    }
  }
  return text;
}

function validateEntity(entity: AppContractEntity): void {
  const entityId = requireSafeIdentifier(entity.id, "entity.id");
  requireText(entity.label, `entity ${entityId}.label`);
  const recordIdField = requireSafeIdentifier(entity.record_id_field, `entity ${entityId}.record_id_field`);
  const titleField = requireSafeIdentifier(entity.title_field, `entity ${entityId}.title_field`);
  if (!Array.isArray(entity.fields) || entity.fields.length === 0) {
    throw new Error(`entity ${entityId}.fields must include at least one field.`);
  }
  if (entity.fields.length > MAX_FIELDS_PER_ENTITY) {
    throw new Error(`entity ${entityId}.fields cannot exceed ${MAX_FIELDS_PER_ENTITY} fields.`);
  }
  const fieldIds = new Set<string>();
  for (const field of entity.fields) {
    const fieldId = requireSafeIdentifier(field.id, `entity ${entityId}.field.id`);
    requireText(field.label, `entity ${entityId}.field ${fieldId}.label`);
    if (!FIELD_TYPES.has(field.type)) throw new Error(`entity ${entityId} field ${fieldId}.type is unsupported.`);
    if (fieldIds.has(fieldId)) throw new Error(`entity ${entityId} has duplicate field ${fieldId}.`);
    fieldIds.add(fieldId);
    validateFieldConfig(field, entityId);
  }
  if (!fieldIds.has(recordIdField)) throw new Error(`entity ${entityId}.record_id_field must reference a declared field.`);
  if (!fieldIds.has(titleField)) throw new Error(`entity ${entityId}.title_field must reference a declared field.`);

  if (entity.api) {
    validateApiPath(entity.api.get, `entity ${entityId}.api.get`, true);
    if (entity.api.list !== undefined) validateApiPath(entity.api.list, `entity ${entityId}.api.list`);
    if (entity.api.create !== undefined) validateApiPath(apiPath(entity.api.create), `entity ${entityId}.api.create`);
    if (entity.api.update !== undefined) validateApiPath(entity.api.update, `entity ${entityId}.api.update`, true);
    if (entity.api.delete !== undefined) validateApiPath(entity.api.delete, `entity ${entityId}.api.delete`, true);
  }
  for (const relationship of entity.relationships ?? []) {
    requireText(relationship.id, `entity ${entityId}.relationship.id`);
    requireText(relationship.entity_id, `entity ${entityId}.relationship.entity_id`);
  }
}

function validateDataModel(dataModel: AppDataModel, manifest: AppManifest): void {
  if (dataModel.schema_version !== "kylon.app_data_model.v1") {
    throw new Error("data_model.schema_version must be kylon.app_data_model.v1.");
  }
  if (!Array.isArray(dataModel.entities) || dataModel.entities.length === 0) {
    throw new Error("data_model.entities must include at least one entity.");
  }
  const manifestEntities = new Map(manifest.data.entities.map((entity) => [entity.id, entity]));
  const entityIds = new Set<string>();
  for (const entity of dataModel.entities) {
    const entityId = requireSafeIdentifier(entity.id, "data_model entity.id");
    if (entityIds.has(entityId)) throw new Error(`data_model duplicates entity ${entityId}.`);
    entityIds.add(entityId);
    if (!manifestEntities.has(entityId)) throw new Error(`data_model entity ${entityId} is not in manifest.`);
    requireSafeIdentifier(entity.table, `data_model entity ${entityId}.table`);
    if (entity.id_column) requireSafeIdentifier(entity.id_column, `data_model entity ${entityId}.id_column`);
    if (entity.created_at_column) requireSafeIdentifier(entity.created_at_column, `data_model entity ${entityId}.created_at_column`);
    if (entity.updated_at_column) requireSafeIdentifier(entity.updated_at_column, `data_model entity ${entityId}.updated_at_column`);
    if (!Array.isArray(entity.fields) || entity.fields.length === 0) {
      throw new Error(`data_model entity ${entityId}.fields must include at least one mapping.`);
    }
    const manifestFields = new Set(manifestEntities.get(entityId)?.fields.map((field) => field.id));
    const fieldIds = new Set<string>();
    for (const field of entity.fields) {
      const fieldId = requireSafeIdentifier(field.id, `data_model entity ${entityId}.field.id`);
      requireSafeIdentifier(field.column, `data_model entity ${entityId}.field ${fieldId}.column`);
      if (fieldIds.has(fieldId)) throw new Error(`data_model entity ${entityId} duplicates field ${fieldId}.`);
      fieldIds.add(fieldId);
      if (!manifestFields.has(fieldId)) throw new Error(`data_model field ${entityId}.${fieldId} is not in manifest.`);
    }
  }
}

function validateOpenApiCoverage(manifest: AppManifest, openapi: Record<string, unknown>): void {
  const info = isRecord(openapi.info) ? openapi.info : null;
  if (info && typeof info.version === "string" && info.version !== manifest.app.version) {
    throw new Error("openapi is stale: info.version does not match manifest.app.version.");
  }
  const paths = isRecord(openapi.paths) ? openapi.paths : {};
  for (const entity of manifest.data.entities) {
    for (const [name, pathOrConfig] of Object.entries(entity.api ?? {})) {
      const path = apiPath(pathOrConfig);
      const pathItem = isRecord(paths[path]) ? paths[path] : null;
      if (!pathItem) throw new Error(`openapi is stale: missing ${entity.id}.${name} path ${path}.`);
      const method = API_METHODS[name as keyof typeof API_METHODS];
      if (!method || !Object.prototype.hasOwnProperty.call(pathItem, method)) {
        throw new Error(`openapi is stale: missing ${entity.id}.${name} method ${method?.toUpperCase() ?? "UNKNOWN"} ${path}.`);
      }
    }
  }
}

export function validateContractSnapshot(
  manifest: AppManifest,
  dataModel: AppDataModel | null,
  openapi: Record<string, unknown>,
): void {
  if (manifest.schema_version !== "kylon.app_manifest.v1") {
    throw new Error("manifest.schema_version must be kylon.app_manifest.v1.");
  }
  requireText(manifest.app.id, "manifest.app.id");
  requireText(manifest.app.name, "manifest.app.name");
  requireText(manifest.app.version, "manifest.app.version");
  requireText(manifest.app.base_url, "manifest.app.base_url");
  if (!Array.isArray(manifest.data.entities)) throw new Error("manifest.data.entities must be an array.");
  if (manifest.data.entities.length > MAX_ENTITIES) {
    throw new Error(`manifest.data.entities cannot exceed ${MAX_ENTITIES} entities.`);
  }
  const entityIds = new Set<string>();
  for (const entity of manifest.data.entities) {
    validateEntity(entity);
    if (entityIds.has(entity.id)) throw new Error(`duplicate entity id ${entity.id}.`);
    entityIds.add(entity.id);
  }
  if (manifest.data.viewer_mode === "required") {
    if (manifest.data.entities.length === 0 || !dataModel) {
      throw new Error("Data Viewer mode required needs manifest entities and a data model.");
    }
    validateDataModel(dataModel, manifest);
  } else if (manifest.data.entities.length > 0 || dataModel) {
    throw new Error("Data Viewer mode disabled requires empty manifest entities and no data model.");
  }
  validateOpenApiCoverage(manifest, openapi);
}
