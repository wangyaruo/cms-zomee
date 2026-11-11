export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && slugPattern.test(value)
}

export function canPublish(role: unknown): boolean {
  return role === 'admin' || role === 'reviewer'
}
