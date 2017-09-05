import angular from 'angular';
import {createElement} from 'react';
import {render, unmountComponentAtNode} from 'react-dom';
import getEventKey from 'react-dom/lib/getEventKey';

import Select from '../select/select';
import MessageBundle from '../message-bundle-ng/message-bundle-ng';

import SelectNgOptions from './select-ng__options';
import SelectLazy from './select-ng__lazy';

const LOADER_DELAY = 150; // delay to show loader in ms
const INFINITE_SCROLL_PACK_SIZE = 50;
const DIALOG_NG_SELECTOR = '[data-anchor=dialog-container][data-in-sidebar=false]';
/**
 * @name Select Ng
 * @category Legacy Angular Components
 * @tags Ring UI Language
 * @description Provides an Angular wrapper for Select.
 * Options argument has one of the following forms:
 * * `label` **`in`** `items`
 * * `label` **`for`** `item` **`in`** `items`
 * * `label` **`for`** `item` **`in`** `items` **`track by`** `trackexpr`
 * * `label` **`select as`** `buttontext` **`describe as`** `description` **`for`** `item` **`in`** `items` **`track by`** `trackexpr`
 * * `select` **`as`** `label` **`select as`** `buttontext` **`for`** `item` **`in`** `items`
 *
 * Where:
 * * `items` is an expression that evaluates to a datasource containing data to iterate over. Datasource can be an array or a function that accepts the `query` parameter and returns a promise of an array filtered by the query.
 * * `item` is a local variable that will refer to each item in the items.
 * * `label` – the result of this expression will be the label for &lt;option&gt; element. The expression will most likely refer to the value variable (e.g. item.name).
 * * `select` – the result of this expression will be bound to the model of the parent &lt;select&gt; element. If not specified, select expression will default to item.
 * * `trackexpr` is used when working with an array of objects. The result of this expression will be used to identify the objects in the array. The trackexpr will most likely refer to the item variable (e.g. item.id). Used to preserve selection even when the options are recreated (e.g. reloaded from the server).
 * * `buttontext` – label for the selected item to be displayed on the button.
 * * `description` – description of an item to display in the option list.
 *
 * Examples:
 * * `item in items`
 * * `item in dataSource(query)`
 * * `item.text for item in items`
 * * `item.text for item in items track by item.id`
 * * `item.text select as item.fullText describe as item.fullDescription for item in items track by item.id`
 * * `item as item.text select as makeFullText(item) for item in items`
 *
 * @example-file ./select-ng.examples.html
 */

const angularModule = angular.module('Ring.select', [SelectNgOptions, MessageBundle]);

angularModule.directive('rgSelect', function rgSelectDirective() {
  const types = {
    input: Select.Type.INPUT,
    button: Select.Type.BUTTON,
    dropdown: Select.Type.CUSTOM,
    suggest: Select.Type.INPUT
  };

  const sizes = {
    s: Select.Size.S,
    m: Select.Size.M,
    l: Select.Size.L
  };

  return {
    /**
     * @property {Object} scope
     * @property {Object} scope.ngModel
     * @property {String} scope.selectType - select type. Can be "button" (default), "input" or "dropdown"
     * @property {String} scope.lazy - Load options lazily. "true" by default.
     * @property {Boolean} scope.withInfiniteScroll - If true, rgSelect calls getOptions with skip parameter when the list is scrolled to the bottom
     * @property {String} scope.options - query for options
     * @property {Boolean} scope.externalFilter - whether or not to use the options function as a filter.
     * "filter" property should not be passed in that case.
     * @property {Boolean} scope.multiple - toggles multiple selection
     * @property {Function} scope.onSelect - callback to call on item selection
     * Receives "selected" property (<rg-select on-select='doSomethingWith(selected)'>)
     * @property {Function} scope.onDeselect - callback to call on item deselection
     * Receives "deselected" property (<rg-select on-deselect='doSomethingWith(deselected)'>)
     * @property {Function} scope.onOpen - callback to call on select popup opening
     * @property {Function} scope.onClose - callback to call on select popup closing
     * @property {Function} scope.onChange - callback to call on selection change
     * Receives "selected" property (<rg-select on-change='doSomethingWith(selected)'>)
     * @property {String} scope.label - Label to place on empty select button
     * @property {String} scope.selectedLabel - Label to replace any selected item/items with
     * @property {String} scope.notFoundMessage - message to display if no options found
     * @property {String} scope.loadingMessage - message to display while loading
     * @property {Object} scope.config - hash to pass to react select component
     * @property {Boolean} scope.configAutoUpdate - whether or not to watch for configuration updates
     * @property {String} scope.size - select size. Can be "S", "M" (default), or "L".
     */
    scope: {
      ngModel: '=',

      selectType: '@',
      lazy: '=?',
      withInfiniteScroll: '=?', // NB: Deprecated! Use infinite-scroll-pack-size="50" instead
      infiniteScrollPackSize: '@',

      options: '@',
      optionsScope: '=',
      label: '@',
      selectedLabel: '@',
      externalFilter: '=?',
      filter: '=?',
      tags: '=?',
      multiple: '=?',
      clear: '=?',
      onSelect: '&',
      onDeselect: '&',
      onOpen: '&',
      onClose: '&',
      onChange: '&',
      notFoundMessage: '@',
      loadingMessage: '@',
      config: '=?',
      configAutoUpdate: '=',
      selectInstance: '=?',
      size: '@'
    },
    bindToController: true,
    controllerAs: 'selectCtrl',
    require: ['?ngModel', 'rgSelect'],
    link: function link(scope, iElement, iAttrs, ctrls) {
      const ngModelCtrl = ctrls[0];
      const rgSelectCtrl = ctrls[1];

      rgSelectCtrl.setNgModelCtrl(ngModelCtrl);
    },
    // eslint-disable-next-line max-len
    controller: function controller($q, $scope, $element, $attrs, $timeout, SelectOptions, RingMessageBundle) {
      /*eslint-disable consistent-this*/
      const ctrl = this;
      /*eslint-enable consistent-this*/
      const element = $element[0];
      const container = document.createElement('span');
      const infiniteScrollPackSize =
        Number(ctrl.infiniteScrollPackSize) ||
        (ctrl.withInfiniteScroll ? INFINITE_SCROLL_PACK_SIZE : 0);

      /**
       * Properties
       */
      ctrl.selectInstance = null;
      ctrl.ngModelCtrl = null;
      ctrl.query = null;
      ctrl.dataReceived = false;

      const scope = ctrl.optionsScope ? ctrl.optionsScope : $scope.$parent;

      ctrl.setNgModelCtrl = ngModelCtrl => {
        ctrl.ngModelCtrl = ngModelCtrl;
      };

      /**
       * @param {Array} options
       */
      function memorizeOptions(options, skip) {
        if (ctrl.loadedOptions && skip > 0) {
          ctrl.loadedOptions = ctrl.loadedOptions.concat(options);
          ctrl.stopLoadingNewOptions = options.length === 0 && infiniteScrollPackSize;
        } else {
          ctrl.loadedOptions = options;
        }
        ctrl.lastSkip = skip;
        return ctrl.loadedOptions;
      }

      function resetMemorizedOptions() {
        ctrl.lastSkip = -1;
        ctrl.loadedOptions = [];
        ctrl.stopLoadingNewOptions = false;
      }

      function getType() {
        // $attrs.type as fallback, not recommended to use because of native "type" attribute
        return ctrl.selectType || $attrs.type;
      }

      function getCurrentSkipParameter(query, prevQuery) {
        if (!infiniteScrollPackSize || query !== prevQuery || !ctrl.loadedOptions) {
          return 0;
        }
        return ctrl.lastSkip < 0 ? 0 : ctrl.lastSkip + infiniteScrollPackSize;
      }

      function isInDialog() {
        const dialogContainer = document.querySelector(DIALOG_NG_SELECTOR);
        return dialogContainer && dialogContainer.contains(element);
      }


      ctrl.syncSelectToNgModel = selectedValue => {
        function valueOf(option) {
          if (option && option.originalModel) {
            return ctrl.optionsParser.getValue(option.originalModel);
          }

          return ctrl.optionsParser.getValue(option);
        }

        if (ctrl.ngModelCtrl) {
          if (getType() === 'suggest') {
            ctrl.ngModelCtrl.$setViewValue(selectedValue.label);
          } else if (Array.isArray(selectedValue)) {
            ctrl.ngModelCtrl.$setViewValue(selectedValue.map(valueOf));
          } else {
            ctrl.ngModelCtrl.$setViewValue(valueOf(selectedValue));
          }
        }
      };

      ctrl.convertNgModelToSelect = model => {
        function convertItem(modelValue) {
          let item = ctrl.optionsParser.getOptionByValue(modelValue, ctrl.loadedOptions || []);

          // could happen when lazily fetching the data
          if (item === undefined) {
            item = modelValue;
          }

          return angular.extend({
            key: ctrl.optionsParser.getKey(item),
            label: ctrl.optionsParser.getLabel(item),
            selectedLabel: ctrl.optionsParser.getSelectedLabel(item),
            description: ctrl.optionsParser.getDescription(item),
            originalModel: item
          }, typeof item === 'object' ? item : null);
        }

        if (model !== undefined && model !== null) {
          if (Array.isArray(model)) {
            return model.map(convertItem);
          } else {
            return convertItem(model);
          }
        }

        return undefined;
      };

      let lastQuery = null;
      let inProcessQueries = 0;
      ctrl.getOptions = (query, skip) => $q.when(ctrl.optionsParser.getOptions(query, skip));

      let loaderDelayTimeout = null;
      ctrl.showLoader = () => {
        if (getType() !== 'suggest') {
          ctrl.selectInstance.rerender({loading: true});
        }
      };

      ctrl.loadOptionsToSelect = query => {
        if (ctrl.stopLoadingNewOptions && query === lastQuery) {
          return;
        }

        ctrl.stopLoadingNewOptions = false;
        const skip = getCurrentSkipParameter(query, lastQuery);
        lastQuery = query;

        $timeout.cancel(loaderDelayTimeout);

        // Delay loader only when there is some data
        // Otherwise, user can notice the "not found" message
        if (ctrl.dataReceived) {
          loaderDelayTimeout = $timeout(ctrl.showLoader, LOADER_DELAY);
        } else {
          ctrl.showLoader();
        }

        inProcessQueries++;
        ctrl.getOptions(query, skip).then(results => {
          inProcessQueries--;
          if (query !== lastQuery) {
            return; // do not process the result if queries don't match
          }

          const items = memorizeOptions(results.data || results, skip).
            map(ctrl.convertNgModelToSelect);
          $timeout.cancel(loaderDelayTimeout);
          ctrl.dataReceived = true;
          ctrl.selectInstance.rerender({
            data: items,
            loading: false
          });
        }).catch(() => {
          inProcessQueries--;
          $timeout.cancel(loaderDelayTimeout);
          ctrl.selectInstance.rerender({
            loading: false
          });
        });
      };

      function setSelectModel(newValue) {
        if (ctrl.ngModelCtrl) {
          ctrl.selectInstance.rerender({
            selected: ctrl.convertNgModelToSelect(newValue)
          });
        }
      }

      function syncNgModelToSelect() {
        $scope.$watch(() => ctrl.ngModelCtrl && ctrl.ngModelCtrl.$modelValue, setSelectModel, true);
      }

      function syncDisabled() {
        $attrs.$observe('disabled', newValue => {
          ctrl.selectInstance.rerender({disabled: newValue});
        });
      }

      function syncMultiple() {
        $scope.$watch(() => ctrl.multiple, () => {
          if (angular.isDefined(ctrl.multiple)) {
            ctrl.selectInstance.rerender({multiple: ctrl.multiple});
          }
        });
      }

      function syncConfig() {
        $scope.$watchCollection(() => ctrl.config, (config, old) => {
          if (config !== old) {
            ctrl.selectInstance.rerender(config);
          }
        });
      }

      function isSelectPopupOpen() {
        return ctrl.selectInstance._popup.isVisible();
      }

      function attachDropdownIfNeeded() {
        if (getType() === 'dropdown') {
          const handler = () => {
            ctrl.selectInstance._clickHandler();
          };
          element.addEventListener('click', handler);
          element.addEventListener('keydown', event => {
            const key = getEventKey(event);
            const modifier = event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;

            if (
              (key === 'Enter' && !modifier || key === ' ')
            ) {
              if (!isSelectPopupOpen()) {
                handler();

                // XXX: preventDefault is needed because some controls (button, input, etc)
                // have an activation behaviour which fires a `click` event on `keypress`
                // @see https://www.w3.org/TR/2017/PR-html51-20170803/editing.html#activation
                event.preventDefault();

                // XXX: stopPropagation is needed because when a React component is rendered with
                // shortcuts, document-level handlers are added. For example, `enter` that leads
                // to this handler being called right after current function's call, which
                // leads to the popup being closed immediately after opening.
                // @see https://www.w3.org/TR/uievents/#Event_dispatch_and_DOM_event_flow
                event.stopPropagation();
              }
            }
          });
        }
      }

      function listenToRouteChanges() {
        $scope.$on('$locationChangeSuccess', () => {
          if (isSelectPopupOpen()) {
            ctrl.selectInstance._hidePopup();
          }
        });
      }

      function listenToDestroy() {
        $scope.$on('$destroy', () => {
          unmountComponentAtNode(container);
        });
      }

      function getSelectType() {
        return types[getType()] || types.button;
      }

      function getSelectSize() {
        return sizes[ctrl.size] || sizes.m;
      }

      /**
       * @param {newValue} newValue New value of options
       * @param {value} value Previous value of options
       */
      function optionsWatcher(newValue, value) {
        memorizeOptions(newValue, 0);

        if (newValue === value) {
          return;
        }

        if (ctrl.ngModelCtrl) {
          setSelectModel(ctrl.ngModelCtrl.$modelValue);
        }
      }

      ctrl.$onInit = () => {
        ctrl.optionsParser = new SelectOptions(scope, ctrl.options);

        ctrl.lazy = ctrl.hasOwnProperty('lazy') ? ctrl.lazy : true;

        /**
         * Provide specific filter function if externalFilter is enabled
         */
        if (ctrl.externalFilter) {
          ctrl.filter = ctrl.filter || {};
          ctrl.filter.fn = () => true;
        }

        ctrl.config = angular.extend({}, {
          selected: ctrl.convertNgModelToSelect(ctrl.ngModel),
          label: ctrl.label || RingMessageBundle.select_label(),
          selectedLabel: ctrl.selectedLabel,
          allowAny: getType() === 'suggest',
          hideArrow: getType() === 'suggest',
          filter: ctrl.filter,
          tags: ctrl.tags,
          multiple: ctrl.multiple,
          popupClassName: $attrs.popupClass,
          clear: ctrl.clear,
          ringPopupTarget: isInDialog() ? 'dialog-ng-popup-container' : null,
          renderOptimization: getType() !== 'dropdown',
          type: getSelectType(),
          loadingMessage: ctrl.loadingMessage || RingMessageBundle.select_loading(),
          notFoundMessage: ctrl.notFoundMessage || RingMessageBundle.select_options_not_found(),
          targetElement: getType() === 'dropdown' ? element : null,
          size: getSelectSize(),
          onBeforeOpen: () => {
            $scope.$evalAsync(() => {
              resetMemorizedOptions();
              ctrl.loadOptionsToSelect(ctrl.query);
            });
          },
          onOpen: () => {
            $scope.$evalAsync(() => {
              ctrl.onOpen();
            });
          },
          onClose: () => {
            ctrl.query = null;
            $scope.$evalAsync(() => {
              ctrl.onClose();
            });
          },
          onSelect: item => {
            $scope.$evalAsync(() => {
              ctrl.onSelect({selected: item});
            });
          },
          onDeselect: item => {
            $scope.$evalAsync(() => {
              ctrl.onDeselect({deselected: item});
            });
          },
          onChange: selected => {
            ctrl.syncSelectToNgModel(selected);

            $scope.$evalAsync(() => {
              ctrl.onChange({selected});
            });
          },
          onFilter: query => {
            $scope.$evalAsync(() => {
              ctrl.query = query;
              if (ctrl.externalFilter) {
                ctrl.loadOptionsToSelect(query);
              }
              if (ctrl.onFilter) {
                ctrl.onFilter(query);
              }
            });
          }
        }, ctrl.config || {});

        if (infiniteScrollPackSize && !ctrl.config.onLoadMore) {
          ctrl.config.onLoadMore = () => {
            if (inProcessQueries === 0) {
              $scope.$evalAsync(() => {
                ctrl.loadOptionsToSelect(ctrl.query);
              });
            }
          };
        }

        if (getType() === 'suggest' || getType() === 'input') {
          ctrl.selectInstance = render(createElement(Select, ctrl.config), container);
        } else {
          ctrl.selectInstance = new SelectLazy(container, ctrl.config, ctrl, getType());
        }

        // Preserve existing contents of the directive
        element.appendChild(container);

        if (!ctrl.lazy) {
          if (!ctrl.optionsParser.datasourceIsFunction) {
            $scope.$watch(() => ctrl.optionsParser.getOptions(ctrl.query, 0), optionsWatcher, true);
          } else {
            ctrl.loadOptionsToSelect(ctrl.query);
          }
        }

        syncNgModelToSelect();
        syncDisabled();
        syncMultiple();
        if (ctrl.configAutoUpdate) {
          syncConfig();
        }
        attachDropdownIfNeeded();
        listenToRouteChanges();
        listenToDestroy();
      };
    }
  };
});

export default angularModule.name;
