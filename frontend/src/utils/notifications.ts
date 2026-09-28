import Swal from 'sweetalert2';

export async function confirmDeletion(itemLabel: string): Promise<boolean> {
  const result = await Swal.fire({
    title: 'Confirm deletion',
    text: `Delete ${itemLabel}? This cannot be undone.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#dc2626',
    focusCancel: true,
    reverseButtons: true,
  });

  return result.isConfirmed;
}

export async function showSuccess(message: string): Promise<void> {
  await Swal.fire({
    title: 'Success',
    text: message,
    icon: 'success',
    confirmButtonText: 'Continue',
  });
}

export async function showError(message: string): Promise<void> {
  await Swal.fire({
    title: 'The operation could not be completed',
    text: message,
    icon: 'error',
    confirmButtonText: 'Close',
  });
}
