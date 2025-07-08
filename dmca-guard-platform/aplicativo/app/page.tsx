
'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card'
import { AnimatedBackground } from '@/components/ui/animated-background'
import { GradientText } from '@/components/ui/gradient-text'
import { GlowButton } from '@/components/ui/glow-button'
import { AnimatedStats } from '@/components/ui/stats-counter'
import { Timeline } from '@/components/ui/timeline'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { cn } from '@/lib/utils'
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
  Lock,
  Bot,
  AlertCircle,
  TrendingUp,
  UserPlus,
  ScanSearch,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react'

export default function HomePage() {
  const pricingPlans = [
    {
      name: 'Starter',
      price: 97,
      description: 'Perfeito para começar sua proteção',
      features: [
        'Até 100 verificações/mês',
        'Monitoramento em 50+ sites',
        'Alertas por email',
        'Suporte via chat',
        'Dashboard básico'
      ],
      color: 'purple' as const,
      popular: false
    },
    {
      name: 'Pro',
      price: 297,
      description: 'Para criadoras profissionais',
      features: [
        'Verificações ilimitadas',
        'Monitoramento em 500+ sites',
        'Alertas por email, SMS e WhatsApp',
        'Suporte prioritário 24/7',
        'Dashboard completo com analytics',
        'API de integração',
        'Remoção automática DMCA'
      ],
      color: 'pink' as const,
      popular: true
    },
    {
      name: 'Enterprise',
      price: null,
      description: 'Soluções personalizadas',
      features: [
        'Tudo do plano Pro',
        'Monitoramento customizado',
        'Equipe dedicada',
        'SLA garantido',
        'Relatórios personalizados',
        'Integração com sistemas',
        'Treinamento da equipe'
      ],
      color: 'blue' as const,
      popular: false
    }
  ]

  const features = [
    {
      icon: Shield,
      title: 'Proteção Automatizada',
      description: 'Sistema de IA que monitora e protege seu conteúdo 24/7 em tempo real.',
      color: 'purple' as const
    },
    {
      icon: Zap,
      title: 'Detecção em Tempo Real',
      description: 'Identificação instantânea de conteúdo vazado com notificações imediatas.',
      color: 'pink' as const
    },
    {
      icon: Bot,
      title: 'IA Treinada',
      description: 'Algoritmos especializados em reconhecimento de conteúdo adulto.',
      color: 'blue' as const
    },
    {
      icon: BarChart3,
      title: 'Analytics Detalhado',
      description: 'Dashboard completo com métricas e insights sobre suas proteções.',
      color: 'purple' as const
    },
    {
      icon: AlertCircle,
      title: 'Alertas Instantâneos',
      description: 'Notificações por email, SMS e WhatsApp quando detectamos vazamentos.',
      color: 'pink' as const
    },
    {
      icon: Mail,
      title: 'DMCA Automático',
      description: 'Envio automatizado de takedowns DMCA para remoção imediata.',
      color: 'blue' as const
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
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <AnimatedBackground variant="gradient" />
        
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-dark mb-8"
            >
              <Bot className="h-4 w-4 text-primary-500" />
              <span className="text-sm font-medium">Powered by AI</span>
              <span className="animate-pulse-glow inline-block w-2 h-2 bg-primary-500 rounded-full" />
            </motion.div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6">
              <GradientText size="6xl" variant="purple-pink" animate>
                Proteja seu Conteúdo
              </GradientText>
              <br />
              <span className="text-foreground">com IA Avançada</span>
            </h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              Monitoramento 24/7 em <span className="text-primary-500 font-semibold">500+ plataformas</span>.
              Detecção instantânea e remoção automática de conteúdo não autorizado.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/auth/register">
                <GlowButton size="lg" variant="gradient" glow="md" className="group">
                  Começar Gratuitamente
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </GlowButton>
              </Link>
              <Link href="/pricing">
                <GlowButton size="lg" variant="outline">
                  Ver Planos e Preços
                </GlowButton>
              </Link>
            </motion.div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20"
          >
            {[
              { icon: Shield, text: '99.9% Precisão', subtext: 'IA treinada' },
              { icon: Clock, text: '<5min Resposta', subtext: 'Detecção rápida' },
              { icon: TrendingUp, text: '543+ Sites', subtext: 'Monitorados' }
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
              >
                <GlassCard variant="purple" glow className="text-center p-6">
                  <stat.icon className="h-8 w-8 mx-auto mb-3 text-primary-500" />
                  <h3 className="text-2xl font-bold">{stat.text}</h3>
                  <p className="text-sm text-muted-foreground">{stat.subtext}</p>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/50 to-background" />
        
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-block px-4 py-1 rounded-full glass-dark text-sm font-medium mb-4"
            >
              RECURSOS PRINCIPAIS
            </motion.span>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <GradientText size="5xl" variant="blue-purple">
                Tecnologia de Ponta
              </GradientText>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Combinamos IA avançada com automação inteligente para proteger seu conteúdo
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <GlassCard 
                  variant={feature.color} 
                  glow 
                  className="h-full p-6 group hover:scale-105 transition-all duration-300"
                >
                  <div className="flex items-start space-x-4">
                    <div className={`
                      w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                      ${feature.color === 'purple' ? 'bg-primary-500/20' : ''}
                      ${feature.color === 'pink' ? 'bg-secondary-500/20' : ''}
                      ${feature.color === 'blue' ? 'bg-accent-blue-500/20' : ''}
                      group-hover:scale-110 transition-transform duration-300
                    `}>
                      <feature.icon className={`
                        h-6 w-6
                        ${feature.color === 'purple' ? 'text-primary-500' : ''}
                        ${feature.color === 'pink' ? 'text-secondary-500' : ''}
                        ${feature.color === 'blue' ? 'text-accent-blue-500' : ''}
                      `} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 relative overflow-hidden">
        <AnimatedBackground variant="particles" className="opacity-30" />
        
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-block px-4 py-1 rounded-full glass-dark text-sm font-medium mb-4"
            >
              RESULTADOS COMPROVADOS
            </motion.span>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <GradientText size="5xl" variant="pink-blue">
                Números que Impressionam
              </GradientText>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Nossa plataforma já protegeu milhares de criadoras de conteúdo
            </p>
          </motion.div>

          <AnimatedStats
            stats={[
              {
                label: 'Sites Monitorados',
                value: 543,
                suffix: '+',
                description: 'Plataformas verificadas 24/7',
                icon: Globe,
                color: 'purple'
              },
              {
                label: 'Taxa de Precisão',
                value: 99.9,
                suffix: '%',
                decimals: 1,
                description: 'Detecção por IA avançada',
                icon: Shield,
                color: 'pink'
              },
              {
                label: 'Tempo de Resposta',
                value: 5,
                prefix: '<',
                suffix: 'min',
                description: 'Ação imediata garantida',
                icon: Clock,
                color: 'blue'
              },
              {
                label: 'Conteúdos Removidos',
                value: 12500,
                suffix: '+',
                description: 'Takedowns bem-sucedidos',
                icon: CheckCircle,
                color: 'purple'
              }
            ]}
          />
        </div>
      </section>

      {/* How it Works Timeline */}
      <section className="py-20 relative">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-block px-4 py-1 rounded-full glass-dark text-sm font-medium mb-4"
            >
              COMO FUNCIONA
            </motion.span>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <GradientText size="5xl" variant="rainbow">
                Proteção em 4 Passos Simples
              </GradientText>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Nossa tecnologia de IA cuida de tudo automaticamente
            </p>
          </motion.div>

          <Timeline
            items={[
              {
                title: 'Configure seu Perfil',
                description: 'Cadastre-se e configure suas preferências de monitoramento. Adicione suas redes sociais e plataformas onde publica conteúdo.',
                icon: UserPlus,
                color: 'purple'
              },
              {
                title: 'IA Monitora seu Conteúdo',
                description: 'Nossa inteligência artificial varre mais de 500 sites continuamente, identificando seu conteúdo com 99.9% de precisão.',
                icon: ScanSearch,
                color: 'pink'
              },
              {
                title: 'Detecta Violações',
                description: 'Quando encontramos conteúdo não autorizado, você recebe alertas instantâneos por email, SMS ou WhatsApp.',
                icon: ShieldAlert,
                color: 'blue'
              },
              {
                title: 'Remove Automaticamente',
                description: 'Enviamos notificações DMCA profissionais e acompanhamos todo o processo de remoção até a conclusão.',
                icon: CheckCircle2,
                color: 'purple'
              }
            ]}
          />
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

      {/* Pricing Section */}
      <section className="py-20 relative overflow-hidden">
        <AnimatedBackground variant="grid" className="opacity-20" />
        
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-block px-4 py-1 rounded-full glass-dark text-sm font-medium mb-4"
            >
              PLANOS E PREÇOS
            </motion.span>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <GradientText size="5xl" variant="purple-pink">
                Escolha seu Plano de Proteção
              </GradientText>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Invista na segurança do seu conteúdo com nossos planos acessíveis
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative"
              >
                {plan.popular && (
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-4 left-1/2 -translate-x-1/2 z-10"
                  >
                    <span className="px-4 py-1 rounded-full bg-gradient-to-r from-secondary-500 to-primary-500 text-white text-sm font-semibold">
                      MAIS POPULAR
                    </span>
                  </motion.div>
                )}
                
                <GlassCard
                  variant={plan.color}
                  glow={plan.popular}
                  className={cn(
                    "h-full p-8 relative",
                    plan.popular && "scale-105 border-2"
                  )}
                >
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-muted-foreground mb-4">{plan.description}</p>
                    
                    <div className="flex items-baseline justify-center gap-2">
                      {plan.price ? (
                        <>
                          <span className="text-sm text-muted-foreground">R$</span>
                          <span className="text-5xl font-bold">{plan.price}</span>
                          <span className="text-sm text-muted-foreground">/mês</span>
                        </>
                      ) : (
                        <span className="text-3xl font-bold">Personalizado</span>
                      )}
                    </div>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle className={cn(
                          "h-5 w-5 flex-shrink-0 mt-0.5",
                          plan.color === 'purple' && "text-primary-500",
                          plan.color === 'pink' && "text-secondary-500",
                          plan.color === 'blue' && "text-accent-blue-500"
                        )} />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <GlowButton
                    variant={plan.popular ? 'gradient' : plan.color}
                    size="lg"
                    className="w-full"
                    glow={plan.popular ? 'md' : 'sm'}
                  >
                    {plan.price ? 'Começar Agora' : 'Falar com Vendas'}
                  </GlowButton>
                </GlassCard>
              </motion.div>
            ))}
          </div>
          
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="text-muted-foreground">
              Todos os planos incluem 14 dias de teste grátis • Cancele quando quiser • Sem taxas ocultas
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 gradient-bg-animated opacity-90" />
        
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            >
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Oferta por tempo limitado</span>
            </motion.div>
            
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              <GradientText size="6xl" variant="purple-pink" animate>
                Proteja seu Conteúdo Agora
              </GradientText>
            </h2>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 leading-relaxed">
              Comece gratuitamente e veja como nossa IA pode proteger seu trabalho
              em mais de 500 plataformas simultaneamente
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link href="/auth/register">
                <GlowButton 
                  size="lg" 
                  variant="gradient" 
                  glow="lg"
                  className="text-lg px-8 py-6 group"
                >
                  Começar Teste Grátis de 14 Dias
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </GlowButton>
              </Link>
              <Link href="/contact">
                <GlowButton 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 py-6"
                >
                  <Mail className="mr-2 h-5 w-5" />
                  Falar com Especialista
                </GlowButton>
              </Link>
            </div>
            
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Cancele quando quiser</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Suporte 24/7</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
