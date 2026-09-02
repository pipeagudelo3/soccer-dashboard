import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { UserInterface } from '@/interfaces/UserInterface.js';

export const useUserStore = defineStore('users', () => {
  const users = ref<UserInterface[]>([]);

  function setUsers(newUsers: UserInterface[]): void {
    users.value = [...newUsers];
  }

  return { users, setUsers };
});
