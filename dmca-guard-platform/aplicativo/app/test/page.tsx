'use client'

import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { WebSocketTest } from '@/components/dashboard/websocket-test';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function TestPage() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Página de Teste - WebSocket
          </h1>
          <p className="text-muted-foreground">
            Esta é uma página de teste para validação da implementação WebSocket.
          </p>
        </div>
        
        <div className="space-y-6">
          <WebSocketTest />
          
          <div className="flex gap-4">
            <Button 
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetch('/api/test-websocket', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      action: 'emit-progress',
                      sessionId: 'test-123',
                      progress: Math.floor(Math.random() * 100),
                      currentKeyword: 'test-keyword-' + Math.random().toString(36).substring(7)
                    })
                  });
                  const data = await res.json();
                  console.log('Progress emitted:', data);
                } catch (error) {
                  console.error('Error:', error);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              Emitir Progresso
            </Button>
            
            <Button 
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetch('/api/test-websocket', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      action: 'emit-test',
                      sessionId: 'test-123'
                    })
                  });
                  const data = await res.json();
                  console.log('Test message emitted:', data);
                } catch (error) {
                  console.error('Error:', error);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              variant="outline"
            >
              Emitir Mensagem de Teste
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
