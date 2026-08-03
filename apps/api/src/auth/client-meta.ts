export type ClientMeta = {
  ip?: string;
  userAgent?: string;
};

export function clientMetaFromReq(req: {
  ip?: string;
  headers?: Record<string, unknown>;
}): ClientMeta {
  const ua = req.headers?.["user-agent"];
  return {
    ip: req.ip,
    userAgent: typeof ua === "string" ? ua : undefined,
  };
}
