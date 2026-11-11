import type { Access, FieldAccess } from 'payload'

export const isAdmin: Access = ({ req }) => req.user?.role === 'admin'
export const isReviewer: Access = ({ req }) =>
  Boolean(req.user && ['admin', 'reviewer'].includes(req.user.role))
export const isEditor: Access = ({ req }) =>
  Boolean(req.user && ['admin', 'reviewer', 'editor'].includes(req.user.role))

export const adminOnlyField: FieldAccess = ({ req }) => req.user?.role === 'admin'

export const publishedOrEditor: Access = isEditor
