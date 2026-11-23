/**
 * /home just forwards to /briefs, the real main page.
 *
 * It stays because the starter's links and tests point at /home.
 */

import { Navigate } from 'react-router-dom'

export default function HomePage() {
  return <Navigate to="/briefs" replace />
}
