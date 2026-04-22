export const isPasswordRecoveryMode = (search: string, hash: string) => {
  const searchParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  const mode = searchParams.get("mode");
  const type = searchParams.get("type") ?? hashParams.get("type");

  return mode === "recovery" || type === "recovery";
};
