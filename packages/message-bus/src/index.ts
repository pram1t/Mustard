/**
 * @openagent/message-bus
 *
 * In-memory event bus with wildcard pattern matching for OpenAgent V2.
 */

export { EventBus } from './bus.js';
export type {
  EventBusConfig,
  HistoryQuery,
  IMessageBus,
  MessageEnvelope,
  MessageHandler,
  MessageType,
  PublishOptions,
  Subscription,
} from './types.js';
