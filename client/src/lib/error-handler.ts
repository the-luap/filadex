import { useTranslation } from "@/i18n";

/**
 * Maps backend error messages to translation keys
 */
export function useErrorTranslation() {
  const { t } = useTranslation();

  /**
   * Get a translated error message based on the error object
   * @param error The error object from the API
   * @returns Translated error message
   */
  const getErrorMessage = (error: any): string => {
    // If error is a string, return it directly
    if (typeof error === 'string') {
      return error;
    }

    // If error is an Error object with a message
    if (error instanceof Error) {
      return mapErrorMessageToTranslation(error.message);
    }

    // If error is an object with a message property
    if (error && typeof error === 'object') {
      if (error.message) {
        return mapErrorMessageToTranslation(error.message);
      }
      if (error.detail) {
        return mapErrorMessageToTranslation(error.detail);
      }
    }

    // Default fallback
    return t('errors.api.internalServerError');
  };

  /**
   * Maps specific error messages to translation keys
   * @param message The error message from the API
   * @returns Translated error message
   */
  const mapErrorMessageToTranslation = (message: string): string => {
    // Authentication errors
    if (message.includes('Not authenticated')) {
      return t('errors.api.notAuthenticated');
    }
    if (message.includes('Invalid username or password')) {
      return t('errors.api.invalidCredentials');
    }
    if (message.includes('Session expired')) {
      return t('errors.api.sessionExpired');
    }
    if (message.includes('Invalid authentication')) {
      return t('errors.api.invalidAuthentication');
    }
    if (message.includes('Unauthorized')) {
      return t('errors.api.unauthorized');
    }
    if (message.includes('change your password before continuing')) {
      return t('errors.api.passwordChangeRequired');
    }

    // Form validation errors
    if (message.includes('Invalid request format')) {
      return t('errors.api.invalidRequestFormat');
    }
    if (message.includes('Username is required')) {
      return t('errors.api.usernameRequired');
    }
    if (message.includes('Password is required')) {
      return t('errors.api.passwordRequired');
    }
    if (message.includes('Name is required')) {
      return t('errors.api.nameRequired');
    }
    if (message.includes('Code is required')) {
      return t('errors.api.codeRequired');
    }
    if (message.includes('Value is required')) {
      return t('errors.api.valueRequired');
    }
    if (message.includes('Username already exists')) {
      return t('errors.api.usernameExists');
    }

    // Resource errors
    if (message.includes('Filament not found')) {
      return t('errors.api.filamentNotFound');
    }
    if (message.includes('Manufacturer not found')) {
      return t('errors.api.manufacturerNotFound');
    }
    if (message.includes('Material not found')) {
      return t('errors.api.materialNotFound');
    }
    if (message.includes('Color not found')) {
      return t('errors.api.colorNotFound');
    }
    if (message.includes('Diameter not found')) {
      return t('errors.api.diameterNotFound');
    }
    if (message.includes('Storage location not found')) {
      return t('errors.api.storageLocationNotFound');
    }
    if (message.includes('User not found')) {
      return t('errors.api.userNotFound');
    }
    if (message.includes('not found') && !message.includes('Page not found')) {
      return t('errors.api.notFound');
    }

    // Resource in use errors
    if (message.includes('manufacturer') && message.includes('in use')) {
      return t('errors.api.manufacturerInUse');
    }
    if (message.includes('material') && message.includes('in use')) {
      return t('errors.api.materialInUse');
    }
    if (message.includes('color') && message.includes('in use')) {
      return t('errors.api.colorInUse');
    }
    if (message.includes('diameter') && message.includes('in use')) {
      return t('errors.api.diameterInUse');
    }
    if (message.includes('storage location') && message.includes('in use')) {
      return t('errors.api.storageLocationInUse');
    }
    if (message.includes('in use')) {
      return t('errors.api.resourceInUse');
    }

    // Generic errors
    if (message.includes('Internal server error')) {
      return t('errors.api.internalServerError');
    }
    if (message.includes('Failed to create')) {
      return t('errors.api.failedToCreate');
    }
    if (message.includes('Failed to update')) {
      return t('errors.api.failedToUpdate');
    }
    if (message.includes('Failed to delete')) {
      return t('errors.api.failedToDelete');
    }
    if (message.includes('Failed to fetch')) {
      return t('errors.api.failedToFetch');
    }

    // Password errors
    if (message.includes('Current password is incorrect')) {
      return t('errors.api.incorrectPassword');
    }
    if (message.includes('Password changed successfully')) {
      return t('errors.api.passwordChangeSuccess');
    }
    if (message.includes('Failed to change password')) {
      return t('errors.api.passwordChangeFailed');
    }

    // Import/Export errors
    if (message.includes('Failed to import')) {
      return t('errors.api.importFailed');
    }
    if (message.includes('Failed to export')) {
      return t('errors.api.exportFailed');
    }

    // If no specific mapping is found, return the original message
    return message;
  };

  return {
    getErrorMessage
  };
}
