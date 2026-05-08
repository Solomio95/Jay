export function calculateNetLeaderboardAmount(input: {
  sales: { amount: number; quantity: number }[];
  returns: { amount: number; quantity: number }[];
}) {
  const salesAmount = input.sales.reduce((sum, item) => sum + item.amount, 0);
  const salesQuantity = input.sales.reduce((sum, item) => sum + item.quantity, 0);
  const returnAmount = input.returns.reduce((sum, item) => sum + item.amount, 0);
  const returnQuantity = input.returns.reduce((sum, item) => sum + item.quantity, 0);

  return {
    amount: roundMoney(Math.max(0, salesAmount - returnAmount)),
    quantity: Math.max(0, salesQuantity - returnQuantity),
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
