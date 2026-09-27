import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class ApiErrorMessageService {
  private readonly translate = inject(TranslateService);

  private readonly errorCodeKeys: Record<string, string> = {
    COLLECTION_LIMIT_REACHED: 'subscriptionLimitErrors.collectionLimitReached',
    EXAMPLE_LIMIT_REACHED: 'subscriptionLimitErrors.exampleLimitReached',
    TEST_LIMIT_REACHED: 'subscriptionLimitErrors.testLimitReached',
    COLLECTION_MEMBER_LIMIT_REACHED: 'subscriptionLimitErrors.collectionMemberLimitReached',
    SCHOOL_USER_LIMIT_REACHED: 'subscriptionLimitErrors.schoolUserLimitReached',
    COLLECTION_OWNER_NOT_FOUND: 'subscriptionLimitErrors.collectionOwnerNotFound',

    COLLECTION_NAME_EMPTY: 'subscriptionLimitErrors.collectionNameEmpty',
    COLLECTION_NAME_EXISTS: 'subscriptionLimitErrors.collectionNameExists',
    USER_NOT_FOUND: 'subscriptionLimitErrors.userNotFound',

    SCHOOL_CAPACITY_BELOW_USAGE: 'subscriptionLimitErrors.schoolCapacityBelowUsage',
    PRO_CAPACITY_BELOW_USAGE: 'subscriptionLimitErrors.proCapacityBelowUsage'
  };

  getMessage(error: any, fallback: string): string {
    const code = this.extractCode(error);
    const key = code ? this.errorCodeKeys[code] : undefined;

    if (key) {
      return this.translate.instant(key, this.extractParams(error));
    }

    const backendMessage = this.extractBackendMessage(error);
    if (backendMessage) {
      return backendMessage;
    }

    if (error?.status === 0) {
      return this.translate.instant('dialog.backend.unreachable');
    }

    if (error?.status === 403) {
      return this.translate.instant('dialog.backend.forbidden');
    }

    if (error?.status === 404) {
      return this.translate.instant('dialog.backend.notFound');
    }

    return fallback;
  }

  isSubscriptionLimitError(error: any): boolean {
    const code = this.extractCode(error);

    return code === 'COLLECTION_LIMIT_REACHED'
      || code === 'EXAMPLE_LIMIT_REACHED'
      || code === 'TEST_LIMIT_REACHED'
      || code === 'COLLECTION_MEMBER_LIMIT_REACHED'
      || code === 'SCHOOL_USER_LIMIT_REACHED'
      || code === 'SCHOOL_CAPACITY_BELOW_USAGE'
      || code === 'PRO_CAPACITY_BELOW_USAGE';
  }

  private extractCode(error: any): string | null {
    const objectCode = error?.error?.code;
    if (typeof objectCode === 'string' && objectCode.trim()) {
      return objectCode.trim();
    }

    if (typeof error?.error === 'string') {
      const value = error.error.trim();

      if (/^[A-Z0-9_]+$/.test(value)) {
        return value;
      }
    }

    return null;
  }

  private extractBackendMessage(error: any): string | null {
    if (typeof error?.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message.trim();
    }

    if (typeof error?.error === 'string') {
      const value = error.error.trim();

      if (value && !/^[A-Z0-9_]+$/.test(value)) {
        return value;
      }
    }

    if (typeof error?.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }

    return null;
  }

  private extractParams(error: any): Record<string, unknown> {
    const body = error?.error;

    if (!body || typeof body !== 'object') {
      return {};
    }

    return {
      current: body.current,
      limit: body.limit,
      plan: this.getPlanLabel(body.plan),
      minimumSeats: body.minimumSeats,
      collections: body.collections,
      schoolUsers: body.schoolUsers,
      examples: body.examples,
      tests: body.tests,
      maxCollectionMembers: body.maxCollectionMembers,
      maxCollections: body.maxCollections,
      maxExamples: body.maxExamples,
      maxTests: body.maxTests,
      maxMembersPerCollection: body.maxMembersPerCollection
    };
  }

  private getPlanLabel(plan: unknown): string {
    const normalized = typeof plan === 'string' ? plan.trim().toUpperCase() : '';

    switch (normalized) {
      case 'FREE':
        return this.translate.instant('profile.subscription.plans.free');
      case 'PRO':
        return this.translate.instant('profile.subscription.plans.pro');
      case 'SCHOOL':
        return this.translate.instant('profile.subscription.plans.school');
      case 'ADMIN':
        return this.translate.instant('profile.subscription.plans.admin');
      default:
        return '';
    }
  }
}
