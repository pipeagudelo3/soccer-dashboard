import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { UserInterface } from '@/interfaces/UserInterface.js';

export const useUserStore = defineStore('users', () => {
  const users = ref<UserInterface[]>([]);

  function addUser(user: UserInterface): void {
    users.value = [...users.value, user];
  }

  function updateUser(updatedUser: UserInterface): void {
    users.value = users.value.map((user) => (user.id === updatedUser.id ? updatedUser : user));
  }

  function removeUser(userId: string): void {
    users.value = users.value.filter((user) => user.id !== userId);
  }

  return { users, addUser, updateUser, removeUser };
});
