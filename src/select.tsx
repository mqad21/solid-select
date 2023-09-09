import {
  Show,
  For,
  splitProps,
  mergeProps,
  Component,
  ParentComponent,
  createEffect,
  createMemo,
  createSignal,
  on,
  createContext,
  useContext,
} from "solid-js";
import {
  createSelect,
  Option as OptionType,
  Value as ValueType,
  CreateSelectProps,
} from "./create-select";
import { createVirtualizer } from '@tanstack/solid-virtual'

interface CommonProps {
  format: (
    data: OptionType | ValueType,
    type: "option" | "value"
  ) => string | undefined;
  placeholder?: string;
  id?: string;
  name?: string;
  class?: string;
  autofocus?: boolean;
  readonly?: boolean;
  loading?: boolean;
  loadingPlaceholder?: string;
  emptyPlaceholder?: string;
}

type SelectReturn = ReturnType<typeof createSelect>;

type SelectProps = CreateSelectProps & Partial<CommonProps>;

const SelectContext = createContext<SelectReturn>();

const useSelect = () => {
  const context = useContext(SelectContext);
  if (!context) throw new Error("No SelectContext found in ancestry.");
  return context;
};

const Select: Component<SelectProps> = (props) => {
  const [selectProps, local] = splitProps(
    mergeProps(
      {
        format: ((data, type) => data) as CommonProps["format"],
        placeholder: "Select...",
        readonly: typeof props.options !== "function",
        loading: false,
        loadingPlaceholder: "Loading...",
        emptyPlaceholder: "No options",
      },
      props
    ),
    [
      "options",
      "optionToValue",
      "isOptionDisabled",
      "multiple",
      "disabled",
      "onInput",
      "onChange",
    ]
  );
  const select = createSelect(selectProps);

  createEffect(
    on(
      () => local.initialValue,
      (value) => value !== undefined && select.setValue(value)
    )
  );

  return (
    <SelectContext.Provider value={select}>
      <Container class={local.class}>
        <Control
          id={local.id}
          name={local.name}
          format={local.format}
          placeholder={local.placeholder}
          autofocus={local.autofocus}
          readonly={local.readonly}
        />
        <List
          loading={local.loading}
          loadingPlaceholder={local.loadingPlaceholder}
          emptyPlaceholder={local.emptyPlaceholder}
          format={local.format}
        />
      </Container>
    </SelectContext.Provider>
  );
};

type ContainerProps = Pick<CommonProps, "class">;

const Container: ParentComponent<ContainerProps> = (props) => {
  const select = useSelect();
  return (
    <div
      class={`solid-select-container ${props.class !== undefined ? props.class : ""
        }`}
      data-disabled={select.disabled}
      onFocusIn={select.onFocusIn}
      onFocusOut={select.onFocusOut}
      onMouseDown={(event) => {
        select.onMouseDown(event);
        event.currentTarget.getElementsByTagName("input")[0].focus();
      }}
    >
      {props.children}
    </div>
  );
};

type ControlProps = Omit<CommonProps, "class">;

const Control: Component<ControlProps> = (props) => {
  const select = useSelect();

  const removeValue = (index: number) => {
    const value = select.value();
    select.setValue([...value.slice(0, index), ...value.slice(index + 1)]);
  };

  return (
    <div
      class="solid-select-control"
      data-multiple={select.multiple}
      data-has-value={select.hasValue()}
      data-disabled={select.disabled}
      onClick={select.onClick}
    >
      <Show when={!select.hasValue() && !select.hasInputValue()}>
        <Placeholder>{props.placeholder}</Placeholder>
      </Show>
      <Show
        when={select.hasValue() && !select.multiple && !select.hasInputValue()}
      >
        <SingleValue>{props.format(select.value(), "value")}</SingleValue>
      </Show>
      <Show when={select.hasValue() && select.multiple}>
        <For each={select.value()}>
          {(value, index) => (
            <MultiValue onRemove={() => removeValue(index())}>
              {props.format(value, "value")}
            </MultiValue>
          )}
        </For>
      </Show>
      <Input
        id={props.id}
        name={props.name}
        autofocus={props.autofocus}
        readonly={props.readonly}
      />
    </div>
  );
};

type PlaceholderProps = Pick<CommonProps, "placeholder">;

const Placeholder: ParentComponent<PlaceholderProps> = (props) => {
  return <div class="solid-select-placeholder">{props.children}</div>;
};

const SingleValue: ParentComponent<{}> = (props) => {
  return <div class="solid-select-single-value">{props.children}</div>;
};

const MultiValue: ParentComponent<{ onRemove: () => void }> = (props) => {
  const select = useSelect();

  return (
    <div class="solid-select-multi-value">
      {props.children}
      <button
        type="button"
        class="solid-select-multi-value-remove"
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          props.onRemove();
        }}
      >
        ⨯
      </button>
    </div>
  );
};

type InputProps = Pick<CommonProps, "id" | "name" | "autofocus" | "readonly">;

const Input: Component<InputProps> = (props) => {
  const select = useSelect();
  return (
    <input
      id={props.id}
      name={props.name}
      class="solid-select-input"
      data-multiple={select.multiple}
      data-is-active={select.isActive()}
      type="text"
      tabIndex={0}
      autocomplete="off"
      autocapitalize="none"
      autofocus={props.autofocus}
      readonly={props.readonly}
      disabled={select.disabled}
      size={1}
      value={select.inputValue()}
      onInput={select.onInput}
      onKeyDown={(event: KeyboardEvent) => {
        select.onKeyDown(event);
        if (!event.defaultPrevented) {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            (event.target as HTMLElement).blur();
          }
        }
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
    />
  );
};

type ListProps = Pick<
  CommonProps,
  "loading" | "loadingPlaceholder" | "emptyPlaceholder" | "format"
>;

const List: Component<ListProps> = (props) => {
  const select = useSelect();

  const [parentRef, setParentRef] = createSignal<HTMLDivElement | null>(null)

  const virtualizer = createVirtualizer({
    count: select.options().length,
    getScrollElement: parentRef,
    estimateSize: () => 45
  })

  // Scroll to top when the input value changes
  createEffect(on(select.inputValue, () => {
    virtualizer.scrollToIndex(0)
  }))

  const items = createMemo(() => {
    return virtualizer.getVirtualItems().filter(item => select.options()[item.index])
  }, select.options().length)

  const totalHeight = createMemo(() => {
    return select.options().length * 45
  }, select.options().length)

  return (
    <Show when={select.isOpen()}>
      <div class="solid-select-list" ref={setParentRef}>
        <Show when={select.options().length > 0}
          fallback={
            <div class="solid-select-list-placeholder">
              {props.emptyPlaceholder}
            </div>
          }
        >
          <div
            style={{
              height: `${totalHeight()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            <Show
              when={!props.loading}
              fallback={
                <div class="solid-select-list-placeholder">
                  {props.loadingPlaceholder}
                </div>
              }
            >
              {items().map((virtualItem) => (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <Option option={select.options()[virtualItem.index]}>
                    {props.format(select.options()[virtualItem.index], "option")}
                  </Option>
                </div>
              ))}
            </Show>
          </div>
        </Show>

      </div>
    </Show>
  );
};

type OptionProps = {
  option: OptionType;
};

const Option: ParentComponent<OptionProps> = (props) => {
  const select = useSelect();

  const scrollIntoViewOnFocus = (element: HTMLDivElement) => {
    createEffect(() => {
      if (select.isOptionFocused(props.option)) {
        element.scrollIntoView({ block: "nearest" });
      }
    });
  };
  return (
    <div
      ref={scrollIntoViewOnFocus}
      data-disabled={select.isOptionDisabled(props.option)}
      data-focused={select.isOptionFocused(props.option)}
      class="solid-select-option"
      onClick={() => select.pickOption(props.option)}
    >
      {props.children}
    </div>
  );
};

export {
  Select,
  Container,
  Control,
  Placeholder,
  SingleValue,
  MultiValue,
  Input,
  List,
  Option,
  SelectContext,
  useSelect,
};
