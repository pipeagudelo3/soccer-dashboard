<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import type { LoginDTO } from '@/dtos/LoginDTO.js';
import { AuthService } from '@/services/AuthService.js';

const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const errorMessage = ref<string | null>(null);
const isSubmitting = ref(false);

function resolveRedirectTarget(): string {
  const redirect = route.query.redirect;
  return typeof redirect === 'string' && redirect.length > 0 ? redirect : '/dashboard';
}

async function handleSubmit(): Promise<void> {
  errorMessage.value = null;
  isSubmitting.value = true;

  const credentials: LoginDTO = {
    email: email.value.trim(),
    password: password.value,
  };

  const isSuccessful = AuthService.login(credentials);

  isSubmitting.value = false;

  if (!isSuccessful) {
    errorMessage.value = 'Invalid email or password.';
    return;
  }

  await router.push(resolveRedirectTarget());
}
</script>

<template>
  <section class="login-view">
    <form class="login-card" @submit.prevent="handleSubmit">
      <h1>Log in</h1>
      <p class="subtitle">Access the Soccer Dashboard with your account.</p>

      <label>
        <span>Email</span>
        <input v-model="email" type="email" autocomplete="username" required />
      </label>

      <label>
        <span>Password</span>
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>

      <button type="submit" class="submit-button" :disabled="isSubmitting">
        {{ isSubmitting ? 'Signing in...' : 'Log in' }}
      </button>

      <p class="demo-credentials">
        Demo accounts &mdash; admin: <code>admin@soccerdashboard.test</code> /
        <code>Admin123!</code>, user: <code>analyst@soccerdashboard.test</code> /
        <code>User123!</code>
      </p>
    </form>
  </section>
</template>

<style scoped>
.login-view {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.login-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(100%, 26rem);
  padding: 2rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.login-card h1 {
  margin: 0;
  color: #0f172a;
}

.subtitle {
  margin: -0.5rem 0 0;
  color: #64748b;
  font-size: 0.9rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: #475569;
  font-size: 0.85rem;
  font-weight: 600;
}

input {
  padding: 0.6rem 0.75rem;
  color: #0f172a;
  font-size: 0.95rem;
  font-weight: 400;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
}

input:focus {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}

.error-message {
  margin: 0;
  padding: 0.6rem 0.75rem;
  color: #b91c1c;
  font-size: 0.85rem;
  background-color: #fee2e2;
  border-radius: 0.5rem;
}

.submit-button {
  padding: 0.65rem 1rem;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 600;
  background-color: #2563eb;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
}

.submit-button:hover {
  background-color: #1d4ed8;
}

.submit-button:disabled {
  background-color: #93c5fd;
  cursor: not-allowed;
}

.demo-credentials {
  margin: 0;
  padding-top: 0.5rem;
  color: #94a3b8;
  font-size: 0.75rem;
  border-top: 1px solid #e2e8f0;
}
</style>
