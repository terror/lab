import type { Host, Ref } from "@earendil-works/chord";
import {
  type ConversationId,
  type ConversationState,
  LabConversation,
  type SetModelInput,
  type SetToolsInput,
  type StopInput,
} from "@lab/wire";
import type { LabClient } from "./client";
import { clientError, Store } from "./store";

export type ConversationSnapshot =
  | {
      readonly value: ConversationState;
      readonly stale: false;
      readonly error: undefined;
    }
  | {
      readonly value: ConversationState | undefined;
      readonly stale: true;
      readonly error: Error | undefined;
    };

export class ConversationClient {
  private readonly state = new Store<ConversationSnapshot>({
    value: undefined,
    stale: true,
    error: undefined,
  });
  private subscribers = 0;
  private unwatch: (() => void) | undefined;
  private reference: Ref<typeof LabConversation> | undefined;
  private readonly disposers: (() => void)[] = [];

  constructor(
    private readonly client: LabClient,
    readonly id: ConversationId,
  ) {}

  readonly getSnapshot = () => this.state.getSnapshot();

  readonly subscribe = (listener: () => void) => {
    const unsubscribe = this.state.subscribe(listener);
    this.subscribers += 1;
    let active = true;

    if (this.subscribers === 1) {
      this.unwatch = this.client.watch(this);
    }

    return () => {
      if (!active) {
        return;
      }

      active = false;
      unsubscribe();
      this.subscribers -= 1;

      if (this.subscribers === 0) {
        this.unwatch?.();
        this.unwatch = undefined;
      }
    };
  };

  readonly stop = (input: StopInput, signal?: AbortSignal) =>
    this.client.stop(this.id, input, signal);

  readonly setModel = (input: SetModelInput, signal?: AbortSignal) =>
    this.client.setModel(this.id, input, signal);

  readonly setTools = (input: SetToolsInput, signal?: AbortSignal) =>
    this.client.setTools(this.id, input, signal);

  attach(host: Host, onFailure: (error: unknown) => void) {
    if (this.reference !== undefined && this.reference.status !== "gone") {
      return;
    }

    this.detach();
    try {
      const reference = host.hold(LabConversation, { id: this.id });
      this.reference = reference;
      let subscribed = false;

      const update = () => {
        if (this.reference !== reference) {
          return;
        }

        if (reference.status === "live" && reference.variant === "default") {
          this.publish({
            value: reference.view.value,
            stale: false,
            error: undefined,
          });

          if (!subscribed) {
            subscribed = true;
            this.disposers.push(
              reference.view.subscribe((value) =>
                this.publish({
                  value,
                  stale: reference.status !== "live",
                  error: undefined,
                }),
              ),
            );
          }
        } else if (reference.status === "gone") {
          this.publish({
            value: this.getSnapshot().value,
            stale: true,
            error: clientError(reference.error),
          });
          onFailure(reference.error);
        } else {
          this.publish({
            value: this.getSnapshot().value,
            stale: true,
            error: undefined,
          });
        }
      };

      this.disposers.push(reference.onStatus(update));
      this.disposers.push(reference.onShape(update));
      update();
    } catch (error) {
      this.detach();
      this.publish({
        value: this.getSnapshot().value,
        stale: true,
        error: clientError(error),
      });
      onFailure(error);
    }
  }

  detach() {
    const reference = this.reference;
    this.reference = undefined;

    for (const dispose of this.disposers.splice(0).reverse()) {
      dispose();
    }

    reference?.release();
    this.publish({ ...this.getSnapshot(), stale: true });
  }

  private publish(snapshot: ConversationSnapshot) {
    const previous = this.getSnapshot();
    const next: ConversationSnapshot =
      snapshot.value?.error?.code === "not_found"
        ? { ...snapshot, stale: true }
        : snapshot;

    if (
      previous.value !== next.value ||
      previous.stale !== next.stale ||
      previous.error !== next.error
    ) {
      this.state.set(next);
    }
  }
}
