import type { MetadataRoute } from "next";
import { SEARCH_ENGINE_INDEXING } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: SEARCH_ENGINE_INDEXING
      ? [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }]
      : [{ userAgent: "*", disallow: "/" }],
  };
}
