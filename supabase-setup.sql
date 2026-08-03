-- ============================================================
-- CONTROLE FINANCEIRO - SETUP DO BANCO DE DADOS SUPABASE
-- Cole este SQL no Supabase > SQL Editor > New Query > Run
-- ============================================================

-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  status                TEXT DEFAULT 'inactive',
  price_id              TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Política: usuário autenticado pode ver apenas sua própria assinatura
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Índice para buscas rápidas por stripe_subscription_id (usado pelo webhook)
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub
  ON public.subscriptions (stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_cust
  ON public.subscriptions (stripe_customer_id);
