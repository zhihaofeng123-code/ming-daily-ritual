declare module "astronomia/solar" {
  const solar: {
    apparentVSOP87(planet: unknown, jde: number): { lon: number; lat: number; range: number };
  };
  export default solar;
}
declare module "astronomia/eqtime" {
  const eqtime: { e(jde: number, planet: unknown): number };
  export default eqtime;
}
declare module "astronomia/planetposition" {
  export class Planet {
    constructor(data: unknown);
  }
}
declare module "astronomia/deltat" {
  const deltat: { deltaT(decimalYear: number): number };
  export default deltat;
}
declare module "astronomia/data/vsop87Bearth" {
  const data: unknown;
  export default data;
}
