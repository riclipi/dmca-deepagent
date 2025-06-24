
'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { 
  Shield, 
  Search, 
  Mail, 
  BarChart3, 
  Clock, 
  CheckCircle,
  Star,
  ArrowRight,
  Zap,
  Globe,
  Lock
} from 'lucide-react'

export default function HomePage() {
  const features = [
    {
      icon: Search,
      title: 'Monitoramento Automatizado',
      description: 'Detectamos automaticamente seu conteúdo em centenas de plataformas usando IA avançada.'
    },
    {
      icon: Mail,
      title: 'Takedowns DMCA',
      description: 'Enviamos notificações DMCA profissionais automaticamente para remoção de conteúdo.'
    },
    {
      icon: BarChart3,
      title: 'Relatórios Detalhados',
      description: 'Acompanhe estatísticas completas de detecções e remoções em tempo real.'
    },
    {
      icon: Clock,
      title: 'Resposta Rápida',
      description: 'Detecção e ação em minutos, não em dias. Proteja seu conteúdo instantaneamente.'
    }
  ]

  const benefits = [
    {
      icon: Shield,
      title: 'Proteção 24/7',
      description: 'Monitoramento contínuo do seu conteúdo em todas as principais plataformas.'
    },
    {
      icon: Zap,
      title: 'Automatização Total',
      description: 'Processo completamente automatizado, desde detecção até remoção.'
    },
    {
      icon: Globe,
      title: 'Cobertura Global',
      description: 'Monitoramos plataformas em todo o mundo, incluindo sites adultos especializados.'
    },
    {
      icon: Lock,
      title: 'Compliance LGPD',
      description: 'Totalmente em conformidade com a LGPD e regulamentações internacionais.'
    }
  ]

  const testimonials = [
    {
      name: 'Ana Silva',
      role: 'Criadora de Conteúdo',
      content: 'O DMCA Guard revolucionou minha proteção online. Já removeu mais de 200 conteúdos vazados!',
      rating: 5
    },
    {
      name: 'Carla Santos',
      role: 'Influenciadora Digital',
      content: 'Finalmente posso dormir tranquila sabendo que meu conteúdo está protegido 24/7.',
      rating: 5
    },
    {
      name: 'Marina Costa',
      role: 'Produtora de Conteúdo',
      content: 'A automação é incrível. Não preciso mais me preocupar com vazamentos.',
      rating: 5
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
                Proteja seu <span className="text-primary">conteúdo digital</span> com IA
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Detectamos e removemos automaticamente conteúdo não autorizado em centenas de plataformas. 
                Proteção 24/7 para criadoras de conteúdo brasileiras.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    Começar Gratuitamente
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Ver Planos
                  </Button>
                </Link>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <Image
                  src="https://img.freepik.com/premium-photo/modern-dashboard-analytics-interface_462685-100163.jpg"
                  alt="Dashboard do DMCA Guard"
                  fill
                  className="object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Como Funciona
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Nossa plataforma automatiza completamente o processo de proteção do seu conteúdo
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full hover:shadow-lg transition-all duration-300 group">
                  <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Por que escolher o DMCA Guard?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Desenvolvido especificamente para criadoras de conteúdo brasileiras, 
                com foco em proteção de conteúdo adulto e compliance total com a LGPD.
              </p>
              
              <div className="space-y-6">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={benefit.title}
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-start space-x-4"
                  >
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{benefit.title}</h3>
                      <p className="text-muted-foreground">{benefit.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                <Image
                  src="https://thumbs.dreamstime.com/b/serious-woman-code-overlay-laptop-typing-cybersecurity-hacker-software-data-analysis-web-programmer-computer-work-292523804.jpg"
                  alt="Criadora protegida pelo DMCA Guard"
                  fill
                  className="object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              O que nossas clientes dizem
            </h2>
            <p className="text-xl text-muted-foreground">
              Mais de 500 criadoras já protegem seu conteúdo conosco
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full hover:shadow-lg transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-center space-x-1 mb-2">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <CardDescription className="text-base italic">
                      "{testimonial.content}"
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Comece a proteger seu conteúdo hoje
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Junte-se a centenas de criadoras que já protegem seu conteúdo com nossa plataforma
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/register">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Começar Gratuitamente
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                  Falar com Especialista
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
