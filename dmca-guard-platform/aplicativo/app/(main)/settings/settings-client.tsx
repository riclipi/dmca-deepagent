'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { User, Mail, Shield, Crown } from "lucide-react"

interface SettingsClientProps {
  session: any
}

export default function SettingsClient({ session }: SettingsClientProps) {
  const router = useRouter()
  const [name, setName] = useState(session?.user?.name || "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório")
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/settings/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      })

      if (response.ok) {
        toast.success("Perfil atualizado com sucesso!")
        router.refresh()
      } else {
        toast.error("Erro ao atualizar perfil")
      }
    } catch (error) {
      toast.error("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      toast.error("Preencha todos os campos de senha")
      return
    }

    if (password !== confirmPassword) {
      toast.error("Senhas não coincidem")
      return
    }

    if (password.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres")
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/settings/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        toast.success("Senha atualizada com sucesso!")
        setPassword("")
        setConfirmPassword("")
      } else {
        toast.error("Erro ao atualizar senha")
      }
    } catch (error) {
      toast.error("Erro de conexão")
    } finally {
      setLoading(false)
    }
  }

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'FREE': return 'bg-gray-500'
      case 'BASIC': return 'bg-blue-500'
      case 'PREMIUM': return 'bg-purple-500'
      case 'ENTERPRISE': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações da Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Email</p>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Plano Atual</p>
              <Badge className={`${getPlanColor(session?.user?.planType)} text-white`}>
                <Crown className="h-3 w-3 mr-1" />
                {session?.user?.planType}
              </Badge>
            </div>
            <Button variant="outline" size="sm">
              Alterar Plano
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Settings */}
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
              placeholder="Seu nome"
            />
          </div>
          <Button onClick={handleUpdateProfile} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Perfil"}
          </Button>
        </CardContent>
      </Card>

      {/* Password Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a nova senha"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme a nova senha"
            />
          </div>
          <Button onClick={handleUpdatePassword} disabled={loading}>
            {loading ? "Alterando..." : "Alterar Senha"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}