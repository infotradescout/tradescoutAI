type AllocationInput = {
  id: string;
  weightedVoteTotal: number;
};

const HUNDRED_PERCENT_CENTS = 10000;

export function computeAllocationShares(inputs: AllocationInput[]): Record<string, number> {
  const shares: Record<string, number> = {};
  if (!inputs.length) return shares;

  const totalWeighted = inputs.reduce(
    (sum, input) => sum + Math.max(0, Number(input.weightedVoteTotal || 0)),
    0
  );
  if (totalWeighted <= 0) {
    for (const input of inputs) shares[input.id] = 0;
    return shares;
  }

  const normalized = inputs.map((input) => {
    const weightedVoteTotal = Math.max(0, Number(input.weightedVoteTotal || 0));
    const rawPercent = (weightedVoteTotal / totalWeighted) * 100;
    const scaledPercent = rawPercent * 100;
    const baseCents = Math.floor(scaledPercent + Number.EPSILON);
    const remainder = scaledPercent - baseCents;
    return {
      id: input.id,
      weightedVoteTotal,
      baseCents,
      remainder,
    };
  });

  const baseTotal = normalized.reduce((sum, item) => sum + item.baseCents, 0);
  let remainingCents = HUNDRED_PERCENT_CENTS - baseTotal;

  if (remainingCents > 0) {
    const byLargestRemainder = [...normalized].sort((left, right) => {
      if (right.remainder !== left.remainder) return right.remainder - left.remainder;
      if (right.weightedVoteTotal !== left.weightedVoteTotal) {
        return right.weightedVoteTotal - left.weightedVoteTotal;
      }
      return left.id.localeCompare(right.id);
    });

    for (let index = 0; index < remainingCents; index += 1) {
      const current = byLargestRemainder[index % byLargestRemainder.length];
      current.baseCents += 1;
    }
  } else if (remainingCents < 0) {
    const bySmallestRemainder = [...normalized].sort((left, right) => {
      if (left.remainder !== right.remainder) return left.remainder - right.remainder;
      if (left.weightedVoteTotal !== right.weightedVoteTotal) {
        return left.weightedVoteTotal - right.weightedVoteTotal;
      }
      return left.id.localeCompare(right.id);
    });

    while (remainingCents < 0) {
      for (const current of bySmallestRemainder) {
        if (remainingCents >= 0) break;
        if (current.baseCents > 0) {
          current.baseCents -= 1;
          remainingCents += 1;
        }
      }
    }
  }

  for (const item of normalized) {
    shares[item.id] = Number((item.baseCents / 100).toFixed(2));
  }

  return shares;
}
