
'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Crown, Star, Zap } from 'lucide-react'
import { plans } from '@/lib/plans'

export default function PricingPage() {
  const plansList = [
    {
      key: 'FREE',
      ...plans.FREE,
      icon: Star,
      popular: false,
      cta: 'Começar Gratuitamente'
    },
    {
      key: 'BASIC',
      ...plans.BASIC,
      icon: Zap,
      popular: true,
      cta: 'Escolher Básico'
    },
    {
      key: 'PREMIUM',
      ...plans.PREMIUM,
      icon: Crown,
      popular: false,
      cta: 'Escolher Premium'
    },
    {
      key: 'ENTERPRISE',
      ...plans.ENTERPRISE,
      icon: Crown,
      popular: false,
      cta: 'Falar com Vendas'
    }
  ]

  const faqs = [
    {
      question: 'Como funciona o período gratuito?',
      answer: 'O plano gratuito permite monitorar até 5 perfis de marca com verificações semanais e até 10 takedowns por mês. Não há limite de tempo.'
    },
    {
      question: 'Posso cancelar a qualquer momento?',
      answer: 'Sim, você pode cancelar sua assinatura a qualquer momento. Não há taxas de cancelamento ou multas.'
    },
    {
      question: 'Como funciona a detecção de conteúdo?',
      answer: 'Usamos IA avançada e algoritmos de reconhecimento de imagem para detectar seu conteúdo em centenas de plataformas automaticamente.'
    },
    {
      question: 'Os takedowns DMCA são garantidos?',
      answer: 'Enviamos notificações DMCA profissionais e legalmente válidas. A remoção depende da resposta da plataforma, mas nossa taxa de sucesso é superior a 85%.'
    },
    {
      question: 'Há suporte para plataformas internacionais?',
      answer: 'Sim, monitoramos plataformas globais e enviamos takedowns em português e inglês conforme necessário.'
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Escolha o plano ideal para você
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Proteja seu conteúdo com nossa tecnologia avançada. Comece gratuitamente e faça upgrade conforme cresce.
            </p>
          </motion.div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {plansList.map((plan, index) => (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="relative"
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Mais Popular
                    </Badge>
                  </div>
                )}
                
                <Card className={`h-full ${plan.popular ? 'ring-2 ring-primary shadow-lg' : ''} hover:shadow-lg transition-all duration-300`}>
                  <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <plan.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-4">
                      <span className="text-3xl font-bold">
                        {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2)}`}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-muted-foreground">/mês</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 flex-1 mb-6">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Link href={plan.key === 'ENTERPRISE' ? '/contact' : '/auth/register'}>
                      <Button 
                        className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
                        variant={plan.popular ? 'default' : 'outline'}
                      >
                        {plan.cta}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Comparison */}
      <section className="py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Compare os recursos
            </h2>
            <p className="text-xl text-muted-foreground">
              Veja o que está incluído em cada plano
            </p>
          </motion.div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-4 px-4">Recurso</th>
                  <th className="text-center py-4 px-4">Gratuito</th>
                  <th className="text-center py-4 px-4">Básico</th>
                  <th className="text-center py-4 px-4">Premium</th>
                  <th className="text-center py-4 px-4">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Perfis de marca</td>
                  <td className="text-center py-4 px-4">5</td>
                  <td className="text-center py-4 px-4">15</td>
                  <td className="text-center py-4 px-4">Ilimitado</td>
                  <td className="text-center py-4 px-4">Ilimitado</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Frequência de monitoramento</td>
                  <td className="text-center py-4 px-4">Semanal</td>
                  <td className="text-center py-4 px-4">Diário</td>
                  <td className="text-center py-4 px-4">Tempo real</td>
                  <td className="text-center py-4 px-4">Tempo real</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Takedowns por mês</td>
                  <td className="text-center py-4 px-4">10</td>
                  <td className="text-center py-4 px-4">50</td>
                  <td className="text-center py-4 px-4">Ilimitado</td>
                  <td className="text-center py-4 px-4">Ilimitado</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Relatórios avançados</td>
                  <td className="text-center py-4 px-4">❌</td>
                  <td className="text-center py-4 px-4">✅</td>
                  <td className="text-center py-4 px-4">✅</td>
                  <td className="text-center py-4 px-4">✅</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">API de integração</td>
                  <td className="text-center py-4 px-4">❌</td>
                  <td className="text-center py-4 px-4">❌</td>
                  <td className="text-center py-4 px-4">✅</td>
                  <td className="text-center py-4 px-4">✅</td>
                </tr>
                <tr className="border-b">
                  <td className="py-4 px-4 font-medium">Suporte prioritário</td>
                  <td className="text-center py-4 px-4">❌</td>
                  <td className="text-center py-4 px-4">✅</td>
                  <td className="text-center py-4 px-4">✅</td>
                  <td className="text-center py-4 px-4">24/7</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Perguntas Frequentes
            </h2>
            <p className="text-xl text-muted-foreground">
              Tire suas dúvidas sobre nossos planos
            </p>
          </motion.div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{faq.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Pronta para proteger seu conteúdo?
            </h2>
            <p className="text-xl text-primary-foreground/80 mb-8">
              Comece gratuitamente e veja como podemos ajudar a proteger seu trabalho
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/register">
                <Button size="lg" variant="secondary">
                  Começar Gratuitamente
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
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
