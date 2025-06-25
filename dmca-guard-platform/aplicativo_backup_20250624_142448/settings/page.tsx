'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function SettingsPage({ session }: { session: any }) {
  const router = useRouter()
  const [name, setName] = useState(session?.user?.name || "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleUpdateProfile = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success("Perfil atualizado")
        router.refresh()
      } else {
        toast.error(data.error || "Erro ao atualizar perfil")
      }
    } catch {
      toast.error("Erro ao atualizar perfil")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success("Senha atualizada")
        setPassword("")
        setConfirmPassword("")
      } else {
        toast.error(data.error || "Erro ao atualizar senha")
      }
    } catch {
      toast.error("Erro ao atualizar senha")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button onClick={handleUpdateProfile} disabled={loading}>
            Salvar Alterações
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button onClick={handleUpdatePassword} disabled={loading}>
            Atualizar Senha
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
