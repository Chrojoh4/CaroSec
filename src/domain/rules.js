// Fail closed. No handbook thresholds or title rules are seeded in this scaffold.
export function requireVerifiedRules(bundle, { localDate, mode }) {
  if (!bundle || bundle.reviewStatus !== 'verified' || !bundle.contentHash || !bundle.sources?.length) {
    throw new Error('Verified rules with source evidence are required');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate ?? '') ||
      !bundle.effectiveFrom || !bundle.modes?.includes(mode) ||
      localDate < bundle.effectiveFrom || (bundle.effectiveTo && localDate > bundle.effectiveTo)) {
    throw new Error('Rules do not apply to this trial date and mode');
  }
  return structuredClone(bundle);
}
