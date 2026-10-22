export function requireAuthenticatedUser(user) {
  if (!user?.id) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }
  return user;
}

export function requireAdmin(user) {
  requireAuthenticatedUser(user);
  if (!user.isAdmin) {
    const error = new Error("Administrator access required.");
    error.statusCode = 403;
    throw error;
  }
  return user;
}
