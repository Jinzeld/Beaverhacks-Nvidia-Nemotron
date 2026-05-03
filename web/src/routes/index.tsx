import { createRoute } from '@tanstack/react-router'
import { SecAgentHome } from '@/components/secagent/SecAgentHome'
import { rootRoute } from './__root'

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: SecAgentHome,
})
