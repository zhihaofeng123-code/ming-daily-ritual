import { NextResponse } from "next/server";
import { searchCities } from "@/lib/ming/cities";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ cities: searchCities(q) });
}
