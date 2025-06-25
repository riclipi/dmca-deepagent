
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      planType: string
      status: string
    }
  }

  interface User {
    planType: string
    status: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    planType: string
    status: string
  }
}
