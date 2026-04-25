const state = {
  plans: [
    { id: 'starter', name: 'Starter', priceMonthly: 0 },
    { id: 'pro', name: 'Pro', priceMonthly: 12 },
    { id: 'team', name: 'Team', priceMonthly: 29 }
  ],
  feedback: []
};

export function getPlans() {
  return state.plans;
}

export function addFeedback(entry) {
  state.feedback.push(entry);
  return entry;
}

export function listFeedback() {
  return state.feedback;
}

