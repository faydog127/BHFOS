export const requireCheckoutRegistration = (result) => {
  const row = Array.isArray(result?.data) ? result.data[0] : result?.data;
  if (result?.error || !row?.ok) {
    throw new Error(`PERSISTENCE_CHECKOUT_REGISTRATION_FAILED:${row?.reason || 'RPC_ERROR'}`);
  }
  return row;
};
