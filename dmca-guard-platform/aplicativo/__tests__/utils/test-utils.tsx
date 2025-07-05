import React from 'react'
import { render } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'

// Mock session data
export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    planType: 'FREE' as const,
  },
  expires: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
}

// Custom render function that includes providers
export function renderWithProviders(
  ui: React.ReactElement,
  {
    session = mockSession,
    ...renderOptions
  } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SessionProvider session={session}>
        {children}
      </SessionProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Re-export everything
export * from '@testing-library/react'
export { renderWithProviders as render }