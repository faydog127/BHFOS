import { useEffect, useState } from "react";

function parseRoute() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, queryString] = raw.split("?");
  const query = {};
  if (queryString) {
    queryString.split("&").forEach((pair) => {
      const [key, value] = pair.split("=");
      if (key) {
        query[decodeURIComponent(key)] = decodeURIComponent(value || "");
      }
    });
  }
  return { path, query };
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}

export function navigate(path) {
  window.location.hash = path.startsWith("/") ? path : `/${path}`;
}

export function matchRoute(pattern, path) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const part = patternParts[i];
    const current = pathParts[i];
    if (part.startsWith(":")) {
      params[part.slice(1)] = current;
    } else if (part !== current) {
      return null;
    }
  }
  return params;
}
