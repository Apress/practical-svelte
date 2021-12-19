
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_rest_props(props, keys) {
        const rest = {};
        keys = new Set(keys);
        for (const k in props)
            if (!keys.has(k) && k[0] !== '$')
                rest[k] = props[k];
        return rest;
    }
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
        let children = target.childNodes;
        // If target is <head>, there may be children without claim_order
        if (target.nodeName === 'HEAD') {
            const myChildren = [];
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (node.claim_order !== undefined) {
                    myChildren.push(node);
                }
            }
            children = myChildren;
        }
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            // with fast path for when we are on the current longest subsequence
            const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append_hydration(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            // Skip nodes of undefined ordering
            while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
                target.actual_end_child = target.actual_end_child.nextSibling;
            }
            if (node !== target.actual_end_child) {
                // We only insert if the ordering of this node should be modified or the parent node is not target
                if (node.claim_order !== undefined || node.parentNode !== target) {
                    target.insertBefore(node, target.actual_end_child);
                }
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target || node.nextSibling !== null) {
            target.appendChild(node);
        }
    }
    function insert_hydration(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append_hydration(target, node);
        }
        else if (node.parentNode !== target || node.nextSibling != anchor) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function set_svg_attributes(node, attributes) {
        for (const key in attributes) {
            attr(node, key, attributes[key]);
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function init_claim_info(nodes) {
        if (nodes.claim_info === undefined) {
            nodes.claim_info = { last_index: 0, total_claimed: 0 };
        }
    }
    function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
        // Try to find nodes in an order such that we lengthen the longest increasing subsequence
        init_claim_info(nodes);
        const resultNode = (() => {
            // We first try to find an element after the previous one
            for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    return node;
                }
            }
            // Otherwise, we try to find one before
            // We iterate in reverse so that we don't go too far back
            for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    else if (replacement === undefined) {
                        // Since we spliced before the last_index, we decrease it
                        nodes.claim_info.last_index--;
                    }
                    return node;
                }
            }
            // If we can't find any matching node, we create a new one
            return createNode();
        })();
        resultNode.claim_order = nodes.claim_info.total_claimed;
        nodes.claim_info.total_claimed += 1;
        return resultNode;
    }
    function claim_element_base(nodes, name, attributes, create_element) {
        return claim_node(nodes, (node) => node.nodeName === name, (node) => {
            const remove = [];
            for (let j = 0; j < node.attributes.length; j++) {
                const attribute = node.attributes[j];
                if (!attributes[attribute.name]) {
                    remove.push(attribute.name);
                }
            }
            remove.forEach(v => node.removeAttribute(v));
            return undefined;
        }, () => create_element(name));
    }
    function claim_element(nodes, name, attributes) {
        return claim_element_base(nodes, name, attributes, element);
    }
    function claim_svg_element(nodes, name, attributes) {
        return claim_element_base(nodes, name, attributes, svg_element);
    }
    function claim_text(nodes, data) {
        return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
            const dataStr = '' + data;
            if (node.data.startsWith(dataStr)) {
                if (node.data.length !== dataStr.length) {
                    return node.splitText(dataStr.length);
                }
            }
            else {
                node.data = dataStr;
            }
        }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
        );
    }
    function claim_space(nodes) {
        return claim_text(nodes, ' ');
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function claim_component(block, parent_nodes) {
        block && block.l(parent_nodes);
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.2' }, detail), true));
    }
    function append_hydration_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append_hydration(target, node);
    }
    function insert_hydration_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert_hydration(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    let cart = writable([]);

    let products = writable([]);
    let counter = writable(0);

    /* src\components\Cart.svelte generated by Svelte v3.44.2 */
    const file$b = "src\\components\\Cart.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (38:2) {#if item.quantity > 0}
    function create_if_block$2(ctx) {
    	let div1;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t0;
    	let span0;
    	let t1_value = /*item*/ ctx[6].name + "";
    	let t1;
    	let t2;
    	let div0;
    	let t3_value = /*item*/ ctx[6].quantity + "";
    	let t3;
    	let t4;
    	let button0;
    	let t5;
    	let t6;
    	let button1;
    	let t7;
    	let t8;
    	let span1;
    	let t9;
    	let t10_value = /*item*/ ctx[6].price * /*item*/ ctx[6].quantity + "";
    	let t10;
    	let t11;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[4](/*item*/ ctx[6]);
    	}

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[5](/*item*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			span0 = element("span");
    			t1 = text(t1_value);
    			t2 = space();
    			div0 = element("div");
    			t3 = text(t3_value);
    			t4 = space();
    			button0 = element("button");
    			t5 = text("+");
    			t6 = space();
    			button1 = element("button");
    			t7 = text("-");
    			t8 = space();
    			span1 = element("span");
    			t9 = text("$");
    			t10 = text(t10_value);
    			t11 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			img = claim_element(div1_nodes, "IMG", { width: true, src: true, alt: true });
    			t0 = claim_space(div1_nodes);
    			span0 = claim_element(div1_nodes, "SPAN", {});
    			var span0_nodes = children(span0);
    			t1 = claim_text(span0_nodes, t1_value);
    			span0_nodes.forEach(detach_dev);
    			t2 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", {});
    			var div0_nodes = children(div0);
    			t3 = claim_text(div0_nodes, t3_value);
    			t4 = claim_space(div0_nodes);
    			button0 = claim_element(div0_nodes, "BUTTON", {});
    			var button0_nodes = children(button0);
    			t5 = claim_text(button0_nodes, "+");
    			button0_nodes.forEach(detach_dev);
    			t6 = claim_space(div0_nodes);
    			button1 = claim_element(div0_nodes, "BUTTON", {});
    			var button1_nodes = children(button1);
    			t7 = claim_text(button1_nodes, "-");
    			button1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t8 = claim_space(div1_nodes);
    			span1 = claim_element(div1_nodes, "SPAN", {});
    			var span1_nodes = children(span1);
    			t9 = claim_text(span1_nodes, "$");
    			t10 = claim_text(span1_nodes, t10_value);
    			span1_nodes.forEach(detach_dev);
    			t11 = claim_space(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img, "width", "50");
    			if (!src_url_equal(img.src, img_src_value = /*item*/ ctx[6].image)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*item*/ ctx[6].name);
    			add_location(img, file$b, 39, 4, 872);
    			add_location(span0, file$b, 40, 4, 929);
    			add_location(button0, file$b, 43, 5, 993);
    			add_location(button1, file$b, 44, 5, 1049);
    			add_location(div0, file$b, 41, 4, 959);
    			add_location(span1, file$b, 46, 4, 1119);
    			attr_dev(div1, "class", "cart-item");
    			add_location(div1, file$b, 38, 3, 843);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, img);
    			append_hydration_dev(div1, t0);
    			append_hydration_dev(div1, span0);
    			append_hydration_dev(span0, t1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t3);
    			append_hydration_dev(div0, t4);
    			append_hydration_dev(div0, button0);
    			append_hydration_dev(button0, t5);
    			append_hydration_dev(div0, t6);
    			append_hydration_dev(div0, button1);
    			append_hydration_dev(button1, t7);
    			append_hydration_dev(div1, t8);
    			append_hydration_dev(div1, span1);
    			append_hydration_dev(span1, t9);
    			append_hydration_dev(span1, t10);
    			append_hydration_dev(div1, t11);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", click_handler, false, false, false),
    					listen_dev(button1, "click", click_handler_1, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*$cart*/ 1 && !src_url_equal(img.src, img_src_value = /*item*/ ctx[6].image)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*$cart*/ 1 && img_alt_value !== (img_alt_value = /*item*/ ctx[6].name)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*$cart*/ 1 && t1_value !== (t1_value = /*item*/ ctx[6].name + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*$cart*/ 1 && t3_value !== (t3_value = /*item*/ ctx[6].quantity + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*$cart*/ 1 && t10_value !== (t10_value = /*item*/ ctx[6].price * /*item*/ ctx[6].quantity + "")) set_data_dev(t10, t10_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(38:2) {#if item.quantity > 0}",
    		ctx
    	});

    	return block;
    }

    // (37:1) {#each $cart as item}
    function create_each_block$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*item*/ ctx[6].quantity > 0 && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*item*/ ctx[6].quantity > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(37:1) {#each $cart as item}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$e(ctx) {
    	let div1;
    	let span;
    	let t0;
    	let t1;
    	let div0;
    	let h4;
    	let t2;
    	let t3;
    	let t4;
    	let each_value = /*$cart*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			span = element("span");
    			t0 = text("Cart");
    			t1 = space();
    			div0 = element("div");
    			h4 = element("h4");
    			t2 = text("Total: $ ");
    			t3 = text(/*total*/ ctx[1]);
    			t4 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			span = claim_element(div1_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, "Cart");
    			span_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h4 = claim_element(div0_nodes, "H4", {});
    			var h4_nodes = children(h4);
    			t2 = claim_text(h4_nodes, "Total: $ ");
    			t3 = claim_text(h4_nodes, /*total*/ ctx[1]);
    			h4_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t4 = claim_space(div1_nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div1_nodes);
    			}

    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "title");
    			add_location(span, file$b, 32, 1, 696);
    			add_location(h4, file$b, 34, 2, 753);
    			attr_dev(div0, "class", "total");
    			add_location(div0, file$b, 33, 1, 730);
    			attr_dev(div1, "class", "cart-list");
    			add_location(div1, file$b, 31, 0, 670);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, span);
    			append_hydration_dev(span, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, h4);
    			append_hydration_dev(h4, t2);
    			append_hydration_dev(h4, t3);
    			append_hydration_dev(div1, t4);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*total*/ 2) set_data_dev(t3, /*total*/ ctx[1]);

    			if (dirty & /*$cart, removeItem, addItem*/ 13) {
    				each_value = /*$cart*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let total;
    	let $cart;
    	validate_store(cart, 'cart');
    	component_subscribe($$self, cart, $$value => $$invalidate(0, $cart = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Cart', slots, []);

    	const removeItem = product => {
    		for (let item of $cart) {
    			if (item.id === product.id) {
    				if (product.quantity > 1) {
    					product.quantity--;
    					cart.set($cart);
    				} else {
    					set_store_value(cart, $cart = $cart.filter(cartItem => cartItem != product), $cart);
    				}

    				return;
    			}
    		}
    	};

    	const addItem = product => {
    		for (let item of $cart) {
    			if (item.id === product.id) {
    				product.quantity++;
    				cart.set($cart);
    				break;
    			}
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Cart> was created with unknown prop '${key}'`);
    	});

    	const click_handler = item => addItem(item);
    	const click_handler_1 = item => removeItem(item);
    	$$self.$capture_state = () => ({ cart, removeItem, addItem, total, $cart });

    	$$self.$inject_state = $$props => {
    		if ('total' in $$props) $$invalidate(1, total = $$props.total);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$cart*/ 1) {
    			$$invalidate(1, total = $cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
    		}
    	};

    	return [$cart, total, removeItem, addItem, click_handler, click_handler_1];
    }

    class Cart extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Cart",
    			options,
    			id: create_fragment$e.name
    		});
    	}
    }

    /* src\components\Button.svelte generated by Svelte v3.44.2 */

    const file$a = "src\\components\\Button.svelte";

    function create_fragment$d(ctx) {
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

    	const block = {
    		c: function create() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", {});
    			var button_nodes = children(button);
    			if (default_slot) default_slot.l(button_nodes);
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(button, file$a, 7, 0, 138);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[0],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Button', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Button> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
    	};

    	return [$$scope, slots, click_handler];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$d.name
    		});
    	}
    }

    /* src\components\Products.svelte generated by Svelte v3.44.2 */

    const { console: console_1$1 } = globals;
    const file$9 = "src\\components\\Products.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (40:8) <Button on:click={() => addToCart(product)}>
    function create_default_slot$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Add to cart");
    		},
    		l: function claim(nodes) {
    			t = claim_text(nodes, "Add to cart");
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(40:8) <Button on:click={() => addToCart(product)}>",
    		ctx
    	});

    	return block;
    }

    // (34:2) {#each $products as product}
    function create_each_block$1(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let h4;
    	let a;
    	let t1_value = /*product*/ ctx[5].name + "";
    	let t1;
    	let a_href_value;
    	let t2;
    	let div1;
    	let p;
    	let t3;
    	let t4_value = /*product*/ ctx[5].price + "";
    	let t4;
    	let t5;
    	let button;
    	let t6;
    	let current;

    	function click_handler() {
    		return /*click_handler*/ ctx[3](/*product*/ ctx[5]);
    	}

    	button = new Button({
    			props: {
    				$$slots: { default: [create_default_slot$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button.$on("click", click_handler);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = space();
    			h4 = element("h4");
    			a = element("a");
    			t1 = text(t1_value);
    			t2 = space();
    			div1 = element("div");
    			p = element("p");
    			t3 = text("$");
    			t4 = text(t4_value);
    			t5 = space();
    			create_component(button.$$.fragment);
    			t6 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", {});
    			var div2_nodes = children(div2);
    			div0 = claim_element(div2_nodes, "DIV", { class: true, style: true });
    			children(div0).forEach(detach_dev);
    			t0 = claim_space(div2_nodes);
    			h4 = claim_element(div2_nodes, "H4", {});
    			var h4_nodes = children(h4);
    			a = claim_element(h4_nodes, "A", { href: true });
    			var a_nodes = children(a);
    			t1 = claim_text(a_nodes, t1_value);
    			a_nodes.forEach(detach_dev);
    			h4_nodes.forEach(detach_dev);
    			t2 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			p = claim_element(div1_nodes, "P", {});
    			var p_nodes = children(p);
    			t3 = claim_text(p_nodes, "$");
    			t4 = claim_text(p_nodes, t4_value);
    			p_nodes.forEach(detach_dev);
    			t5 = claim_space(div1_nodes);
    			claim_component(button.$$.fragment, div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t6 = claim_space(div2_nodes);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "image");
    			set_style(div0, "background-image", "url(" + /*product*/ ctx[5].image + ")");
    			add_location(div0, file$9, 35, 6, 696);
    			attr_dev(a, "href", a_href_value = "product/" + /*product*/ ctx[5].id);
    			add_location(a, file$9, 36, 10, 780);
    			add_location(h4, file$9, 36, 6, 776);
    			add_location(p, file$9, 38, 8, 869);
    			attr_dev(div1, "class", "cta");
    			add_location(div1, file$9, 37, 6, 842);
    			add_location(div2, file$9, 34, 4, 683);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div0);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, h4);
    			append_hydration_dev(h4, a);
    			append_hydration_dev(a, t1);
    			append_hydration_dev(div2, t2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, t3);
    			append_hydration_dev(p, t4);
    			append_hydration_dev(div1, t5);
    			mount_component(button, div1, null);
    			append_hydration_dev(div2, t6);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (!current || dirty & /*$products*/ 1) {
    				set_style(div0, "background-image", "url(" + /*product*/ ctx[5].image + ")");
    			}

    			if ((!current || dirty & /*$products*/ 1) && t1_value !== (t1_value = /*product*/ ctx[5].name + "")) set_data_dev(t1, t1_value);

    			if (!current || dirty & /*$products*/ 1 && a_href_value !== (a_href_value = "product/" + /*product*/ ctx[5].id)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if ((!current || dirty & /*$products*/ 1) && t4_value !== (t4_value = /*product*/ ctx[5].price + "")) set_data_dev(t4, t4_value);
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 256) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(button);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(34:2) {#each $products as product}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let div;
    	let t;
    	let cart_1;
    	let current;
    	let each_value = /*$products*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	cart_1 = new Cart({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			create_component(cart_1.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div_nodes);
    			}

    			div_nodes.forEach(detach_dev);
    			t = claim_space(nodes);
    			claim_component(cart_1.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "product-list");
    			add_location(div, file$9, 32, 0, 619);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			insert_hydration_dev(target, t, anchor);
    			mount_component(cart_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*addToCart, $products*/ 3) {
    				each_value = /*$products*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(cart_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(cart_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(cart_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let $cart;
    	let $products;
    	validate_store(cart, 'cart');
    	component_subscribe($$self, cart, $$value => $$invalidate(4, $cart = $$value));
    	validate_store(products, 'products');
    	component_subscribe($$self, products, $$value => $$invalidate(0, $products = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Products', slots, []);
    	let { location } = $$props;

    	const addToCart = product => {
    		console.log("Added");
    		let isFaund = false;

    		for (let item of $cart) {
    			if (item.id === product.id) {
    				product.quantity++;

    				//$cart = $cart;
    				isFaund = true;

    				break;
    			}
    		}

    		if (!isFaund) {
    			set_store_value(cart, $cart = [...$cart, product], $cart);
    		}
    	};

    	const writable_props = ['location'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Products> was created with unknown prop '${key}'`);
    	});

    	const click_handler = product => addToCart(product);

    	$$self.$$set = $$props => {
    		if ('location' in $$props) $$invalidate(2, location = $$props.location);
    	};

    	$$self.$capture_state = () => ({
    		products,
    		cart,
    		Cart,
    		Button,
    		location,
    		addToCart,
    		$cart,
    		$products
    	});

    	$$self.$inject_state = $$props => {
    		if ('location' in $$props) $$invalidate(2, location = $$props.location);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [$products, addToCart, location, click_handler];
    }

    class Products extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, { location: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Products",
    			options,
    			id: create_fragment$c.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*location*/ ctx[2] === undefined && !('location' in props)) {
    			console_1$1.warn("<Products> was created without expected prop 'location'");
    		}
    	}

    	get location() {
    		throw new Error("<Products>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set location(value) {
    		throw new Error("<Products>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-inline-svg\src\inline-svg.svelte generated by Svelte v3.44.2 */

    const { Error: Error_1, console: console_1 } = globals;
    const file$8 = "node_modules\\svelte-inline-svg\\src\\inline-svg.svelte";

    function create_fragment$b(ctx) {
    	let svg;
    	let mounted;
    	let dispose;

    	let svg_levels = [
    		{ xmlns: "http://www.w3.org/2000/svg" },
    		/*svgAttrs*/ ctx[0],
    		exclude(/*$$props*/ ctx[2], ['src', 'transformSrc']),
    		{ contenteditable: "true" }
    	];

    	let svg_data = {};

    	for (let i = 0; i < svg_levels.length; i += 1) {
    		svg_data = assign(svg_data, svg_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", { xmlns: true, contenteditable: true });
    			children(svg).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_svg_attributes(svg, svg_data);
    			if (/*svgContent*/ ctx[1] === void 0) add_render_callback(() => /*svg_input_handler*/ ctx[5].call(svg));
    			add_location(svg, file$8, 107, 0, 2662);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);

    			if (/*svgContent*/ ctx[1] !== void 0) {
    				svg.innerHTML = /*svgContent*/ ctx[1];
    			}

    			if (!mounted) {
    				dispose = listen_dev(svg, "input", /*svg_input_handler*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			set_svg_attributes(svg, svg_data = get_spread_update(svg_levels, [
    				{ xmlns: "http://www.w3.org/2000/svg" },
    				dirty & /*svgAttrs*/ 1 && /*svgAttrs*/ ctx[0],
    				dirty & /*$$props*/ 4 && exclude(/*$$props*/ ctx[2], ['src', 'transformSrc']),
    				{ contenteditable: "true" }
    			]));

    			if (dirty & /*svgContent*/ 2 && /*svgContent*/ ctx[1] !== svg.innerHTML) {
    				svg.innerHTML = /*svgContent*/ ctx[1];
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function exclude(obj, exclude) {
    	Object.keys(obj).filter(key => exclude.includes(key)).forEach(key => delete obj[key]);
    	return obj;
    }

    function filterAttrs(attrs) {
    	return Object.keys(attrs).reduce(
    		(result, key) => {
    			if (attrs[key] !== false && attrs[key] !== null && attrs[key] !== undefined) {
    				result[key] = attrs[key];
    			}

    			return result;
    		},
    		{}
    	);
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Inline_svg', slots, []);
    	const dispatch = createEventDispatcher();
    	let { src } = $$props;
    	let { transformSrc = svg => svg } = $$props;

    	onMount(() => {
    		inline(src);
    	});

    	let cache = {};
    	let isLoaded = false;
    	let svgAttrs = {};
    	let svgContent;

    	function download(url) {
    		return new Promise((resolve, reject) => {
    				const request = new XMLHttpRequest();
    				request.open('GET', url, true);

    				request.onload = () => {
    					if (request.status >= 200 && request.status < 400) {
    						try {
    							// Setup a parser to convert the response to text/xml in order for it to be manipulated and changed
    							const parser = new DOMParser();

    							const result = parser.parseFromString(request.responseText, 'text/xml');
    							let svgEl = result.querySelector('svg');

    							if (svgEl) {
    								// Apply transformation
    								svgEl = transformSrc(svgEl);

    								resolve(svgEl);
    							} else {
    								reject(new Error('Loaded file is not valid SVG"'));
    							}
    						} catch(error) {
    							reject(error);
    						}
    					} else {
    						reject(new Error('Error loading SVG'));
    					}
    				};

    				request.onerror = reject;
    				request.send();
    			});
    	}

    	function inline(src) {
    		// fill cache by src with promise
    		if (!cache[src]) {
    			// notify svg is unloaded
    			if (isLoaded) {
    				isLoaded = false;
    				dispatch('unloaded');
    			}

    			// download
    			cache[src] = download(src);
    		}

    		// inline svg when cached promise resolves
    		cache[src].then(async svg => {
    			// copy attrs
    			const attrs = svg.attributes;

    			for (let i = attrs.length - 1; i >= 0; i--) {
    				$$invalidate(0, svgAttrs[attrs[i].name] = attrs[i].value, svgAttrs);
    			}

    			// copy inner html
    			$$invalidate(1, svgContent = svg.innerHTML);

    			// render svg element
    			await tick();

    			isLoaded = true;
    			dispatch('loaded');
    		}).catch(error => {
    			// remove cached rejected promise so next image can try load again
    			delete cache[src];

    			console.error(error);
    		});
    	}

    	function svg_input_handler() {
    		svgContent = this.innerHTML;
    		$$invalidate(1, svgContent);
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(2, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ('src' in $$new_props) $$invalidate(3, src = $$new_props.src);
    		if ('transformSrc' in $$new_props) $$invalidate(4, transformSrc = $$new_props.transformSrc);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		createEventDispatcher,
    		tick,
    		dispatch,
    		src,
    		transformSrc,
    		cache,
    		isLoaded,
    		svgAttrs,
    		svgContent,
    		exclude,
    		filterAttrs,
    		download,
    		inline
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(2, $$props = assign(assign({}, $$props), $$new_props));
    		if ('src' in $$props) $$invalidate(3, src = $$new_props.src);
    		if ('transformSrc' in $$props) $$invalidate(4, transformSrc = $$new_props.transformSrc);
    		if ('cache' in $$props) cache = $$new_props.cache;
    		if ('isLoaded' in $$props) isLoaded = $$new_props.isLoaded;
    		if ('svgAttrs' in $$props) $$invalidate(0, svgAttrs = $$new_props.svgAttrs);
    		if ('svgContent' in $$props) $$invalidate(1, svgContent = $$new_props.svgContent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$props = exclude_internal_props($$props);
    	return [svgAttrs, svgContent, $$props, src, transformSrc, svg_input_handler];
    }

    class Inline_svg extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, { src: 3, transformSrc: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Inline_svg",
    			options,
    			id: create_fragment$b.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*src*/ ctx[3] === undefined && !('src' in props)) {
    			console_1.warn("<Inline_svg> was created without expected prop 'src'");
    		}
    	}

    	get src() {
    		throw new Error_1("<Inline_svg>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set src(value) {
    		throw new Error_1("<Inline_svg>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transformSrc() {
    		throw new Error_1("<Inline_svg>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transformSrc(value) {
    		throw new Error_1("<Inline_svg>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Footer.svelte generated by Svelte v3.44.2 */
    const file$7 = "src\\components\\Footer.svelte";

    function create_fragment$a(ctx) {
    	let footer;
    	let div0;
    	let span0;
    	let t0;
    	let t1;
    	let div1;
    	let span1;
    	let a0;
    	let inlinesvg0;
    	let t2;
    	let a1;
    	let inlinesvg1;
    	let t3;
    	let a2;
    	let inlinesvg2;
    	let current;
    	const inlinesvg0_spread_levels = [{ src: "/images/facebook.svg" }, /*attributes*/ ctx[0]];
    	let inlinesvg0_props = {};

    	for (let i = 0; i < inlinesvg0_spread_levels.length; i += 1) {
    		inlinesvg0_props = assign(inlinesvg0_props, inlinesvg0_spread_levels[i]);
    	}

    	inlinesvg0 = new Inline_svg({ props: inlinesvg0_props, $$inline: true });
    	const inlinesvg1_spread_levels = [{ src: "/images/instagram.svg" }, /*attributes*/ ctx[0]];
    	let inlinesvg1_props = {};

    	for (let i = 0; i < inlinesvg1_spread_levels.length; i += 1) {
    		inlinesvg1_props = assign(inlinesvg1_props, inlinesvg1_spread_levels[i]);
    	}

    	inlinesvg1 = new Inline_svg({ props: inlinesvg1_props, $$inline: true });
    	const inlinesvg2_spread_levels = [{ src: "/images/twitter.svg" }, /*attributes*/ ctx[0]];
    	let inlinesvg2_props = {};

    	for (let i = 0; i < inlinesvg2_spread_levels.length; i += 1) {
    		inlinesvg2_props = assign(inlinesvg2_props, inlinesvg2_spread_levels[i]);
    	}

    	inlinesvg2 = new Inline_svg({ props: inlinesvg2_props, $$inline: true });

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			div0 = element("div");
    			span0 = element("span");
    			t0 = text("© Small Coffee Shop 2021");
    			t1 = space();
    			div1 = element("div");
    			span1 = element("span");
    			a0 = element("a");
    			create_component(inlinesvg0.$$.fragment);
    			t2 = space();
    			a1 = element("a");
    			create_component(inlinesvg1.$$.fragment);
    			t3 = space();
    			a2 = element("a");
    			create_component(inlinesvg2.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			footer = claim_element(nodes, "FOOTER", {});
    			var footer_nodes = children(footer);
    			div0 = claim_element(footer_nodes, "DIV", {});
    			var div0_nodes = children(div0);
    			span0 = claim_element(div0_nodes, "SPAN", {});
    			var span0_nodes = children(span0);
    			t0 = claim_text(span0_nodes, "© Small Coffee Shop 2021");
    			span0_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(footer_nodes);
    			div1 = claim_element(footer_nodes, "DIV", {});
    			var div1_nodes = children(div1);
    			span1 = claim_element(div1_nodes, "SPAN", {});
    			var span1_nodes = children(span1);
    			a0 = claim_element(span1_nodes, "A", { href: true });
    			var a0_nodes = children(a0);
    			claim_component(inlinesvg0.$$.fragment, a0_nodes);
    			a0_nodes.forEach(detach_dev);
    			t2 = claim_space(span1_nodes);
    			a1 = claim_element(span1_nodes, "A", { href: true });
    			var a1_nodes = children(a1);
    			claim_component(inlinesvg1.$$.fragment, a1_nodes);
    			a1_nodes.forEach(detach_dev);
    			t3 = claim_space(span1_nodes);
    			a2 = claim_element(span1_nodes, "A", { href: true });
    			var a2_nodes = children(a2);
    			claim_component(inlinesvg2.$$.fragment, a2_nodes);
    			a2_nodes.forEach(detach_dev);
    			span1_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			footer_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(span0, file$7, 14, 4, 245);
    			add_location(div0, file$7, 13, 2, 234);
    			attr_dev(a0, "href", "https://facebook.com/smallcoffeeshop");
    			add_location(a0, file$7, 18, 6, 326);
    			attr_dev(a1, "href", "https://instagram.com/smallcoffeeshop");
    			add_location(a1, file$7, 19, 6, 441);
    			attr_dev(a2, "href", "https://Twitter.com/smallcoffeeshop");
    			add_location(a2, file$7, 20, 6, 558);
    			add_location(span1, file$7, 17, 4, 312);
    			add_location(div1, file$7, 16, 2, 301);
    			add_location(footer, file$7, 12, 0, 222);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, footer, anchor);
    			append_hydration_dev(footer, div0);
    			append_hydration_dev(div0, span0);
    			append_hydration_dev(span0, t0);
    			append_hydration_dev(footer, t1);
    			append_hydration_dev(footer, div1);
    			append_hydration_dev(div1, span1);
    			append_hydration_dev(span1, a0);
    			mount_component(inlinesvg0, a0, null);
    			append_hydration_dev(span1, t2);
    			append_hydration_dev(span1, a1);
    			mount_component(inlinesvg1, a1, null);
    			append_hydration_dev(span1, t3);
    			append_hydration_dev(span1, a2);
    			mount_component(inlinesvg2, a2, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const inlinesvg0_changes = (dirty & /*attributes*/ 1)
    			? get_spread_update(inlinesvg0_spread_levels, [inlinesvg0_spread_levels[0], get_spread_object(/*attributes*/ ctx[0])])
    			: {};

    			inlinesvg0.$set(inlinesvg0_changes);

    			const inlinesvg1_changes = (dirty & /*attributes*/ 1)
    			? get_spread_update(inlinesvg1_spread_levels, [inlinesvg1_spread_levels[0], get_spread_object(/*attributes*/ ctx[0])])
    			: {};

    			inlinesvg1.$set(inlinesvg1_changes);

    			const inlinesvg2_changes = (dirty & /*attributes*/ 1)
    			? get_spread_update(inlinesvg2_spread_levels, [inlinesvg2_spread_levels[0], get_spread_object(/*attributes*/ ctx[0])])
    			: {};

    			inlinesvg2.$set(inlinesvg2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(inlinesvg0.$$.fragment, local);
    			transition_in(inlinesvg1.$$.fragment, local);
    			transition_in(inlinesvg2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(inlinesvg0.$$.fragment, local);
    			transition_out(inlinesvg1.$$.fragment, local);
    			transition_out(inlinesvg2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    			destroy_component(inlinesvg0);
    			destroy_component(inlinesvg1);
    			destroy_component(inlinesvg2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let attributes;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ InlineSVG: Inline_svg, attributes });

    	$$self.$inject_state = $$props => {
    		if ('attributes' in $$props) $$invalidate(0, attributes = $$props.attributes);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$invalidate(0, attributes = { width: 30, height: 30, fill: "#FFF" });
    	return [attributes];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* src\components\Header.svelte generated by Svelte v3.44.2 */
    const file$6 = "src\\components\\Header.svelte";

    function create_fragment$9(ctx) {
    	let header;
    	let div0;
    	let span0;
    	let inlinesvg0;
    	let t0;
    	let span1;
    	let t1;
    	let t2;
    	let div1;
    	let span2;
    	let inlinesvg1;
    	let t3;
    	let span3;
    	let t4_value = /*$cart*/ ctx[2].length + "";
    	let t4;
    	let current;
    	const inlinesvg0_spread_levels = [{ src: "/images/logo.svg" }, /*attributes*/ ctx[1]];
    	let inlinesvg0_props = {};

    	for (let i = 0; i < inlinesvg0_spread_levels.length; i += 1) {
    		inlinesvg0_props = assign(inlinesvg0_props, inlinesvg0_spread_levels[i]);
    	}

    	inlinesvg0 = new Inline_svg({ props: inlinesvg0_props, $$inline: true });
    	const inlinesvg1_spread_levels = [{ src: "/images/shoppingcart.svg" }, /*attributesCart*/ ctx[0]];
    	let inlinesvg1_props = {};

    	for (let i = 0; i < inlinesvg1_spread_levels.length; i += 1) {
    		inlinesvg1_props = assign(inlinesvg1_props, inlinesvg1_spread_levels[i]);
    	}

    	inlinesvg1 = new Inline_svg({ props: inlinesvg1_props, $$inline: true });

    	const block = {
    		c: function create() {
    			header = element("header");
    			div0 = element("div");
    			span0 = element("span");
    			create_component(inlinesvg0.$$.fragment);
    			t0 = space();
    			span1 = element("span");
    			t1 = text("Small Coffee Company");
    			t2 = space();
    			div1 = element("div");
    			span2 = element("span");
    			create_component(inlinesvg1.$$.fragment);
    			t3 = space();
    			span3 = element("span");
    			t4 = text(t4_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			header = claim_element(nodes, "HEADER", {});
    			var header_nodes = children(header);
    			div0 = claim_element(header_nodes, "DIV", {});
    			var div0_nodes = children(div0);
    			span0 = claim_element(div0_nodes, "SPAN", {});
    			var span0_nodes = children(span0);
    			claim_component(inlinesvg0.$$.fragment, span0_nodes);
    			span0_nodes.forEach(detach_dev);
    			t0 = claim_space(div0_nodes);
    			span1 = claim_element(div0_nodes, "SPAN", {});
    			var span1_nodes = children(span1);
    			t1 = claim_text(span1_nodes, "Small Coffee Company");
    			span1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t2 = claim_space(header_nodes);
    			div1 = claim_element(header_nodes, "DIV", {});
    			var div1_nodes = children(div1);
    			span2 = claim_element(div1_nodes, "SPAN", {});
    			var span2_nodes = children(span2);
    			claim_component(inlinesvg1.$$.fragment, span2_nodes);
    			span2_nodes.forEach(detach_dev);
    			t3 = claim_space(div1_nodes);
    			span3 = claim_element(div1_nodes, "SPAN", {});
    			var span3_nodes = children(span3);
    			t4 = claim_text(span3_nodes, t4_value);
    			span3_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			header_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(span0, file$6, 19, 4, 335);
    			add_location(span1, file$6, 20, 4, 406);
    			add_location(div0, file$6, 18, 2, 324);
    			add_location(span2, file$6, 23, 4, 464);
    			add_location(span3, file$6, 24, 4, 547);
    			add_location(div1, file$6, 22, 2, 453);
    			add_location(header, file$6, 17, 0, 312);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, header, anchor);
    			append_hydration_dev(header, div0);
    			append_hydration_dev(div0, span0);
    			mount_component(inlinesvg0, span0, null);
    			append_hydration_dev(div0, t0);
    			append_hydration_dev(div0, span1);
    			append_hydration_dev(span1, t1);
    			append_hydration_dev(header, t2);
    			append_hydration_dev(header, div1);
    			append_hydration_dev(div1, span2);
    			mount_component(inlinesvg1, span2, null);
    			append_hydration_dev(div1, t3);
    			append_hydration_dev(div1, span3);
    			append_hydration_dev(span3, t4);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const inlinesvg0_changes = (dirty & /*attributes*/ 2)
    			? get_spread_update(inlinesvg0_spread_levels, [inlinesvg0_spread_levels[0], get_spread_object(/*attributes*/ ctx[1])])
    			: {};

    			inlinesvg0.$set(inlinesvg0_changes);

    			const inlinesvg1_changes = (dirty & /*attributesCart*/ 1)
    			? get_spread_update(inlinesvg1_spread_levels, [
    					inlinesvg1_spread_levels[0],
    					get_spread_object(/*attributesCart*/ ctx[0])
    				])
    			: {};

    			inlinesvg1.$set(inlinesvg1_changes);
    			if ((!current || dirty & /*$cart*/ 4) && t4_value !== (t4_value = /*$cart*/ ctx[2].length + "")) set_data_dev(t4, t4_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(inlinesvg0.$$.fragment, local);
    			transition_in(inlinesvg1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(inlinesvg0.$$.fragment, local);
    			transition_out(inlinesvg1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			destroy_component(inlinesvg0);
    			destroy_component(inlinesvg1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let attributes;
    	let attributesCart;
    	let $cart;
    	validate_store(cart, 'cart');
    	component_subscribe($$self, cart, $$value => $$invalidate(2, $cart = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		cart,
    		InlineSVG: Inline_svg,
    		attributesCart,
    		attributes,
    		$cart
    	});

    	$$self.$inject_state = $$props => {
    		if ('attributesCart' in $$props) $$invalidate(0, attributesCart = $$props.attributesCart);
    		if ('attributes' in $$props) $$invalidate(1, attributes = $$props.attributes);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$invalidate(1, attributes = { width: 50, height: 50 });
    	$$invalidate(0, attributesCart = { width: 30, height: 30 });
    	return [attributesCart, attributes, $cart];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src\components\Product.svelte generated by Svelte v3.44.2 */
    const file$5 = "src\\components\\Product.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (37:4) {#if product.id == individualID}
    function create_if_block$1(ctx) {
    	let div0;
    	let p0;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t0;
    	let div1;
    	let p1;
    	let t1_value = /*product*/ ctx[6].name + "";
    	let t1;
    	let t2;
    	let p2;
    	let t3;
    	let t4;
    	let t5;
    	let p3;
    	let t6_value = /*product*/ ctx[6].description + "";
    	let t6;
    	let t7;
    	let h2;
    	let t8;
    	let t9_value = /*product*/ ctx[6].price + "";
    	let t9;
    	let t10;
    	let button;
    	let t11;
    	let current;

    	function click_handler() {
    		return /*click_handler*/ ctx[3](/*product*/ ctx[6]);
    	}

    	button = new Button({
    			props: {
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button.$on("click", click_handler);

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			p0 = element("p");
    			img = element("img");
    			t0 = space();
    			div1 = element("div");
    			p1 = element("p");
    			t1 = text(t1_value);
    			t2 = space();
    			p2 = element("p");
    			t3 = text("SKU: ");
    			t4 = text(/*individualID*/ ctx[1]);
    			t5 = space();
    			p3 = element("p");
    			t6 = text(t6_value);
    			t7 = space();
    			h2 = element("h2");
    			t8 = text("$");
    			t9 = text(t9_value);
    			t10 = space();
    			create_component(button.$$.fragment);
    			t11 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", {});
    			var div0_nodes = children(div0);
    			p0 = claim_element(div0_nodes, "P", {});
    			var p0_nodes = children(p0);
    			img = claim_element(p0_nodes, "IMG", { src: true, alt: true });
    			p0_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t0 = claim_space(nodes);
    			div1 = claim_element(nodes, "DIV", {});
    			var div1_nodes = children(div1);
    			p1 = claim_element(div1_nodes, "P", {});
    			var p1_nodes = children(p1);
    			t1 = claim_text(p1_nodes, t1_value);
    			p1_nodes.forEach(detach_dev);
    			t2 = claim_space(div1_nodes);
    			p2 = claim_element(div1_nodes, "P", {});
    			var p2_nodes = children(p2);
    			t3 = claim_text(p2_nodes, "SKU: ");
    			t4 = claim_text(p2_nodes, /*individualID*/ ctx[1]);
    			p2_nodes.forEach(detach_dev);
    			t5 = claim_space(div1_nodes);
    			p3 = claim_element(div1_nodes, "P", {});
    			var p3_nodes = children(p3);
    			t6 = claim_text(p3_nodes, t6_value);
    			p3_nodes.forEach(detach_dev);
    			t7 = claim_space(div1_nodes);
    			h2 = claim_element(div1_nodes, "H2", {});
    			var h2_nodes = children(h2);
    			t8 = claim_text(h2_nodes, "$");
    			t9 = claim_text(h2_nodes, t9_value);
    			h2_nodes.forEach(detach_dev);
    			t10 = claim_space(div1_nodes);
    			claim_component(button.$$.fragment, div1_nodes);
    			t11 = claim_space(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = /*product*/ ctx[6].large_image)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*product*/ ctx[6].name);
    			add_location(img, file$5, 38, 11, 767);
    			add_location(p0, file$5, 38, 8, 764);
    			add_location(div0, file$5, 37, 6, 749);
    			add_location(p1, file$5, 41, 8, 864);
    			add_location(p2, file$5, 42, 8, 895);
    			add_location(p3, file$5, 43, 8, 931);
    			add_location(h2, file$5, 44, 8, 969);
    			add_location(div1, file$5, 40, 6, 849);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			append_hydration_dev(div0, p0);
    			append_hydration_dev(p0, img);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, p1);
    			append_hydration_dev(p1, t1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div1, p2);
    			append_hydration_dev(p2, t3);
    			append_hydration_dev(p2, t4);
    			append_hydration_dev(div1, t5);
    			append_hydration_dev(div1, p3);
    			append_hydration_dev(p3, t6);
    			append_hydration_dev(div1, t7);
    			append_hydration_dev(div1, h2);
    			append_hydration_dev(h2, t8);
    			append_hydration_dev(h2, t9);
    			append_hydration_dev(div1, t10);
    			mount_component(button, div1, null);
    			append_hydration_dev(div1, t11);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (!current || dirty & /*$products*/ 1 && !src_url_equal(img.src, img_src_value = /*product*/ ctx[6].large_image)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*$products*/ 1 && img_alt_value !== (img_alt_value = /*product*/ ctx[6].name)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if ((!current || dirty & /*$products*/ 1) && t1_value !== (t1_value = /*product*/ ctx[6].name + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*$products*/ 1) && t6_value !== (t6_value = /*product*/ ctx[6].description + "")) set_data_dev(t6, t6_value);
    			if ((!current || dirty & /*$products*/ 1) && t9_value !== (t9_value = /*product*/ ctx[6].price + "")) set_data_dev(t9, t9_value);
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 512) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			destroy_component(button);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(37:4) {#if product.id == individualID}",
    		ctx
    	});

    	return block;
    }

    // (46:8) <Button on:click={() => addToCart(product)}>
    function create_default_slot$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Add to cart");
    		},
    		l: function claim(nodes) {
    			t = claim_text(nodes, "Add to cart");
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(46:8) <Button on:click={() => addToCart(product)}>",
    		ctx
    	});

    	return block;
    }

    // (36:2) {#each $products as product }
    function create_each_block(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*product*/ ctx[6].id == /*individualID*/ ctx[1] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*product*/ ctx[6].id == /*individualID*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$products*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(36:2) {#each $products as product }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let a;
    	let t0_value = "<< Back to Shop" + "";
    	let t0;
    	let t1;
    	let div;
    	let current;
    	let each_value = /*$products*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", { href: true });
    			var a_nodes = children(a);
    			t0 = claim_text(a_nodes, t0_value);
    			a_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			div = claim_element(nodes, "DIV", { id: true });
    			var div_nodes = children(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div_nodes);
    			}

    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "href", "/products");
    			add_location(a, file$5, 32, 0, 598);
    			attr_dev(div, "id", "productdetails");
    			add_location(div, file$5, 34, 0, 645);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			append_hydration_dev(a, t0);
    			insert_hydration_dev(target, t1, anchor);
    			insert_hydration_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*addToCart, $products, individualID*/ 7) {
    				each_value = /*$products*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let $cart;
    	let $products;
    	validate_store(cart, 'cart');
    	component_subscribe($$self, cart, $$value => $$invalidate(4, $cart = $$value));
    	validate_store(products, 'products');
    	component_subscribe($$self, products, $$value => $$invalidate(0, $products = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Product', slots, []);
    	let individualID = document.location.pathname.split("/")[2];
    	let individualName;

    	const addToCart = product => {
    		let isFaund = false;

    		for (let item of $cart) {
    			if (item.id === product.id) {
    				product.quantity++;
    				cart.set($cart);
    				isFaund = true;
    				break;
    			}
    		}

    		if (!isFaund) {
    			set_store_value(cart, $cart = [...$cart, product], $cart);
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Product> was created with unknown prop '${key}'`);
    	});

    	const click_handler = product => addToCart(product);

    	$$self.$capture_state = () => ({
    		products,
    		cart,
    		Button,
    		individualID,
    		individualName,
    		addToCart,
    		$cart,
    		$products
    	});

    	$$self.$inject_state = $$props => {
    		if ('individualID' in $$props) $$invalidate(1, individualID = $$props.individualID);
    		if ('individualName' in $$props) individualName = $$props.individualName;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [$products, individualID, addToCart, click_handler];
    }

    class Product extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Product",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src\components\CartLength.svelte generated by Svelte v3.44.2 */

    function create_fragment$7(ctx) {
    	const block = {
    		c: noop,
    		l: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CartLength', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CartLength> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class CartLength extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CartLength",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src\pages\About.svelte generated by Svelte v3.44.2 */

    const file$4 = "src\\pages\\About.svelte";

    function create_fragment$6(ctx) {
    	let section;
    	let h2;
    	let t0;
    	let t1;
    	let div;
    	let img;
    	let img_src_value;
    	let t2;
    	let p0;
    	let t3;
    	let t4;
    	let p1;
    	let t5;

    	const block = {
    		c: function create() {
    			section = element("section");
    			h2 = element("h2");
    			t0 = text("About Us");
    			t1 = space();
    			div = element("div");
    			img = element("img");
    			t2 = space();
    			p0 = element("p");
    			t3 = text("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas sed odio id nulla gravida rhoncus. Suspendisse potenti. In volutpat nibh non tellus laoreet, vitae faucibus ipsum sollicitudin. Duis viverra pulvinar tempus. Phasellus odio nunc, imperdiet vitae diam quis, sollicitudin pretium massa. Donec molestie mauris id semper sagittis.");
    			t4 = space();
    			p1 = element("p");
    			t5 = text("Vivamus euismod arcu non velit pulvinar, in egestas mauris tincidunt. Vivamus eget elit non est semper elementum. Quisque turpis elit, tristique eu elit at, rhoncus ullamcorper eros. Integer efficitur efficitur libero, venenatis rhoncus sapien posuere ut. Nulla semper, magna at luctus luctus, orci lacus scelerisque erat, id consequat quam mauris sed neque.");
    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", {});
    			var section_nodes = children(section);
    			h2 = claim_element(section_nodes, "H2", {});
    			var h2_nodes = children(h2);
    			t0 = claim_text(h2_nodes, "About Us");
    			h2_nodes.forEach(detach_dev);
    			t1 = claim_space(section_nodes);
    			div = claim_element(section_nodes, "DIV", { id: true });
    			var div_nodes = children(div);
    			img = claim_element(div_nodes, "IMG", { src: true, alt: true });
    			div_nodes.forEach(detach_dev);
    			t2 = claim_space(section_nodes);
    			p0 = claim_element(section_nodes, "P", {});
    			var p0_nodes = children(p0);
    			t3 = claim_text(p0_nodes, "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas sed odio id nulla gravida rhoncus. Suspendisse potenti. In volutpat nibh non tellus laoreet, vitae faucibus ipsum sollicitudin. Duis viverra pulvinar tempus. Phasellus odio nunc, imperdiet vitae diam quis, sollicitudin pretium massa. Donec molestie mauris id semper sagittis.");
    			p0_nodes.forEach(detach_dev);
    			t4 = claim_space(section_nodes);
    			p1 = claim_element(section_nodes, "P", {});
    			var p1_nodes = children(p1);
    			t5 = claim_text(p1_nodes, "Vivamus euismod arcu non velit pulvinar, in egestas mauris tincidunt. Vivamus eget elit non est semper elementum. Quisque turpis elit, tristique eu elit at, rhoncus ullamcorper eros. Integer efficitur efficitur libero, venenatis rhoncus sapien posuere ut. Nulla semper, magna at luctus luctus, orci lacus scelerisque erat, id consequat quam mauris sed neque.");
    			p1_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(h2, file$4, 5, 2, 36);
    			if (!src_url_equal(img.src, img_src_value = "images/banner.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "banner");
    			add_location(img, file$4, 9, 4, 180);
    			attr_dev(div, "id", "banner");
    			add_location(div, file$4, 8, 2, 157);
    			add_location(p0, file$4, 12, 2, 244);
    			add_location(p1, file$4, 13, 2, 596);
    			add_location(section, file$4, 4, 0, 23);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);
    			append_hydration_dev(section, h2);
    			append_hydration_dev(h2, t0);
    			append_hydration_dev(section, t1);
    			append_hydration_dev(section, div);
    			append_hydration_dev(div, img);
    			append_hydration_dev(section, t2);
    			append_hydration_dev(section, p0);
    			append_hydration_dev(p0, t3);
    			append_hydration_dev(section, t4);
    			append_hydration_dev(section, p1);
    			append_hydration_dev(p1, t5);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('About', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<About> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class About extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "About",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\pages\Home.svelte generated by Svelte v3.44.2 */

    const file$3 = "src\\pages\\Home.svelte";

    function create_fragment$5(ctx) {
    	let section;
    	let span0;
    	let t0;
    	let t1;
    	let div0;
    	let img0;
    	let img0_src_value;
    	let t2;
    	let p0;
    	let t3;
    	let t4;
    	let span1;
    	let t5;
    	let t6;
    	let div1;
    	let img1;
    	let img1_src_value;
    	let t7;
    	let img2;
    	let img2_src_value;
    	let t8;
    	let img3;
    	let img3_src_value;
    	let t9;
    	let p1;
    	let t10;

    	const block = {
    		c: function create() {
    			section = element("section");
    			span0 = element("span");
    			t0 = text("Welcome to Small Coffee Company - high quality great coffee, roasted with love in the heart of Yorkshire");
    			t1 = space();
    			div0 = element("div");
    			img0 = element("img");
    			t2 = space();
    			p0 = element("p");
    			t3 = text("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas sed odio id nulla gravida rhoncus. Suspendisse potenti. In volutpat nibh non tellus laoreet, vitae faucibus ipsum sollicitudin. Duis viverra pulvinar tempus. Phasellus odio nunc, imperdiet vitae diam quis, sollicitudin pretium massa. Donec molestie mauris id semper sagittis.");
    			t4 = space();
    			span1 = element("span");
    			t5 = text("New Arrivals");
    			t6 = space();
    			div1 = element("div");
    			img1 = element("img");
    			t7 = space();
    			img2 = element("img");
    			t8 = space();
    			img3 = element("img");
    			t9 = space();
    			p1 = element("p");
    			t10 = text("Vivamus euismod arcu non velit pulvinar, in egestas mauris tincidunt. Vivamus eget elit non est semper elementum. Quisque turpis elit, tristique eu elit at, rhoncus ullamcorper eros. Integer efficitur efficitur libero, venenatis rhoncus sapien posuere ut. Nulla semper, magna at luctus luctus, orci lacus scelerisque erat, id consequat quam mauris sed neque.");
    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", {});
    			var section_nodes = children(section);
    			span0 = claim_element(section_nodes, "SPAN", { class: true });
    			var span0_nodes = children(span0);
    			t0 = claim_text(span0_nodes, "Welcome to Small Coffee Company - high quality great coffee, roasted with love in the heart of Yorkshire");
    			span0_nodes.forEach(detach_dev);
    			t1 = claim_space(section_nodes);
    			div0 = claim_element(section_nodes, "DIV", { id: true });
    			var div0_nodes = children(div0);
    			img0 = claim_element(div0_nodes, "IMG", { src: true, alt: true });
    			div0_nodes.forEach(detach_dev);
    			t2 = claim_space(section_nodes);
    			p0 = claim_element(section_nodes, "P", {});
    			var p0_nodes = children(p0);
    			t3 = claim_text(p0_nodes, "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas sed odio id nulla gravida rhoncus. Suspendisse potenti. In volutpat nibh non tellus laoreet, vitae faucibus ipsum sollicitudin. Duis viverra pulvinar tempus. Phasellus odio nunc, imperdiet vitae diam quis, sollicitudin pretium massa. Donec molestie mauris id semper sagittis.");
    			p0_nodes.forEach(detach_dev);
    			t4 = claim_space(section_nodes);
    			span1 = claim_element(section_nodes, "SPAN", { class: true });
    			var span1_nodes = children(span1);
    			t5 = claim_text(span1_nodes, "New Arrivals");
    			span1_nodes.forEach(detach_dev);
    			t6 = claim_space(section_nodes);
    			div1 = claim_element(section_nodes, "DIV", { id: true });
    			var div1_nodes = children(div1);
    			img1 = claim_element(div1_nodes, "IMG", { src: true, alt: true });
    			t7 = claim_space(div1_nodes);
    			img2 = claim_element(div1_nodes, "IMG", { src: true, alt: true });
    			t8 = claim_space(div1_nodes);
    			img3 = claim_element(div1_nodes, "IMG", { src: true, alt: true });
    			div1_nodes.forEach(detach_dev);
    			t9 = claim_space(section_nodes);
    			p1 = claim_element(section_nodes, "P", {});
    			var p1_nodes = children(p1);
    			t10 = claim_text(p1_nodes, "Vivamus euismod arcu non velit pulvinar, in egestas mauris tincidunt. Vivamus eget elit non est semper elementum. Quisque turpis elit, tristique eu elit at, rhoncus ullamcorper eros. Integer efficitur efficitur libero, venenatis rhoncus sapien posuere ut. Nulla semper, magna at luctus luctus, orci lacus scelerisque erat, id consequat quam mauris sed neque.");
    			p1_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span0, "class", "welcome");
    			add_location(span0, file$3, 6, 2, 134);
    			if (!src_url_equal(img0.src, img0_src_value = "images/banner.jpg")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "banner");
    			add_location(img0, file$3, 8, 4, 294);
    			attr_dev(div0, "id", "banner");
    			add_location(div0, file$3, 7, 2, 271);
    			add_location(p0, file$3, 11, 2, 354);
    			attr_dev(span1, "class", "welcome");
    			add_location(span1, file$3, 13, 2, 708);
    			if (!src_url_equal(img1.src, img1_src_value = "images/1.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "image1");
    			add_location(img1, file$3, 15, 4, 781);
    			if (!src_url_equal(img2.src, img2_src_value = "images/2.png")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "image2");
    			add_location(img2, file$3, 16, 4, 826);
    			if (!src_url_equal(img3.src, img3_src_value = "images/3.png")) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "image3");
    			add_location(img3, file$3, 17, 4, 871);
    			attr_dev(div1, "id", "newarrivals");
    			add_location(div1, file$3, 14, 2, 753);
    			add_location(p1, file$3, 20, 2, 926);
    			add_location(section, file$3, 4, 0, 23);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);
    			append_hydration_dev(section, span0);
    			append_hydration_dev(span0, t0);
    			append_hydration_dev(section, t1);
    			append_hydration_dev(section, div0);
    			append_hydration_dev(div0, img0);
    			append_hydration_dev(section, t2);
    			append_hydration_dev(section, p0);
    			append_hydration_dev(p0, t3);
    			append_hydration_dev(section, t4);
    			append_hydration_dev(section, span1);
    			append_hydration_dev(span1, t5);
    			append_hydration_dev(section, t6);
    			append_hydration_dev(section, div1);
    			append_hydration_dev(div1, img1);
    			append_hydration_dev(div1, t7);
    			append_hydration_dev(div1, img2);
    			append_hydration_dev(div1, t8);
    			append_hydration_dev(div1, img3);
    			append_hydration_dev(section, t9);
    			append_hydration_dev(section, p1);
    			append_hydration_dev(p1, t10);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\pages\Coffee.svelte generated by Svelte v3.44.2 */

    const file$2 = "src\\pages\\Coffee.svelte";

    function create_fragment$4(ctx) {
    	let section;
    	let h1;
    	let t0;
    	let t1;
    	let div;
    	let img;
    	let img_src_value;
    	let t2;
    	let p0;
    	let t3;
    	let t4;
    	let p1;
    	let t5;

    	const block = {
    		c: function create() {
    			section = element("section");
    			h1 = element("h1");
    			t0 = text("Our Coffee");
    			t1 = space();
    			div = element("div");
    			img = element("img");
    			t2 = space();
    			p0 = element("p");
    			t3 = text("Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas sed odio id nulla gravida rhoncus. Suspendisse potenti. In volutpat nibh non tellus laoreet, vitae faucibus ipsum sollicitudin. Duis viverra pulvinar tempus. Phasellus odio nunc, imperdiet vitae diam quis, sollicitudin pretium massa. Donec molestie mauris id semper sagittis.");
    			t4 = space();
    			p1 = element("p");
    			t5 = text("Vivamus euismod arcu non velit pulvinar, in egestas mauris tincidunt. Vivamus eget elit non est semper elementum. Quisque turpis elit, tristique eu elit at, rhoncus ullamcorper eros. Integer efficitur efficitur libero, venenatis rhoncus sapien posuere ut. Nulla semper, magna at luctus luctus, orci lacus scelerisque erat, id consequat quam mauris sed neque.");
    			this.h();
    		},
    		l: function claim(nodes) {
    			section = claim_element(nodes, "SECTION", {});
    			var section_nodes = children(section);
    			h1 = claim_element(section_nodes, "H1", {});
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, "Our Coffee");
    			h1_nodes.forEach(detach_dev);
    			t1 = claim_space(section_nodes);
    			div = claim_element(section_nodes, "DIV", { id: true });
    			var div_nodes = children(div);
    			img = claim_element(div_nodes, "IMG", { src: true, alt: true });
    			div_nodes.forEach(detach_dev);
    			t2 = claim_space(section_nodes);
    			p0 = claim_element(section_nodes, "P", {});
    			var p0_nodes = children(p0);
    			t3 = claim_text(p0_nodes, "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas sed odio id nulla gravida rhoncus. Suspendisse potenti. In volutpat nibh non tellus laoreet, vitae faucibus ipsum sollicitudin. Duis viverra pulvinar tempus. Phasellus odio nunc, imperdiet vitae diam quis, sollicitudin pretium massa. Donec molestie mauris id semper sagittis.");
    			p0_nodes.forEach(detach_dev);
    			t4 = claim_space(section_nodes);
    			p1 = claim_element(section_nodes, "P", {});
    			var p1_nodes = children(p1);
    			t5 = claim_text(p1_nodes, "Vivamus euismod arcu non velit pulvinar, in egestas mauris tincidunt. Vivamus eget elit non est semper elementum. Quisque turpis elit, tristique eu elit at, rhoncus ullamcorper eros. Integer efficitur efficitur libero, venenatis rhoncus sapien posuere ut. Nulla semper, magna at luctus luctus, orci lacus scelerisque erat, id consequat quam mauris sed neque.");
    			p1_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(h1, file$2, 9, 2, 83);
    			if (!src_url_equal(img.src, img_src_value = "images/banner.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "banner");
    			add_location(img, file$2, 13, 4, 229);
    			attr_dev(div, "id", "banner");
    			add_location(div, file$2, 12, 2, 206);
    			add_location(p0, file$2, 16, 2, 289);
    			add_location(p1, file$2, 17, 2, 641);
    			add_location(section, file$2, 8, 0, 70);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, section, anchor);
    			append_hydration_dev(section, h1);
    			append_hydration_dev(h1, t0);
    			append_hydration_dev(section, t1);
    			append_hydration_dev(section, div);
    			append_hydration_dev(div, img);
    			append_hydration_dev(section, t2);
    			append_hydration_dev(section, p0);
    			append_hydration_dev(p0, t3);
    			append_hydration_dev(section, t4);
    			append_hydration_dev(section, p1);
    			append_hydration_dev(p1, t5);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Coffee', slots, []);
    	let { location } = $$props;
    	const writable_props = ['location'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Coffee> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('location' in $$props) $$invalidate(0, location = $$props.location);
    	};

    	$$self.$capture_state = () => ({ location });

    	$$self.$inject_state = $$props => {
    		if ('location' in $$props) $$invalidate(0, location = $$props.location);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [location];
    }

    class Coffee extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { location: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Coffee",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*location*/ ctx[0] === undefined && !('location' in props)) {
    			console.warn("<Coffee> was created without expected prop 'location'");
    		}
    	}

    	get location() {
    		throw new Error("<Coffee>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set location(value) {
    		throw new Error("<Coffee>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const LOCATION = {};
    const ROUTER = {};

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    function getLocation(source) {
      return {
        ...source.location,
        state: source.history.state,
        key: (source.history.state && source.history.state.key) || "initial"
      };
    }

    function createHistory(source, options) {
      const listeners = [];
      let location = getLocation(source);

      return {
        get location() {
          return location;
        },

        listen(listener) {
          listeners.push(listener);

          const popstateListener = () => {
            location = getLocation(source);
            listener({ location, action: "POP" });
          };

          source.addEventListener("popstate", popstateListener);

          return () => {
            source.removeEventListener("popstate", popstateListener);

            const index = listeners.indexOf(listener);
            listeners.splice(index, 1);
          };
        },

        navigate(to, { state, replace = false } = {}) {
          state = { ...state, key: Date.now() + "" };
          // try...catch iOS Safari limits to 100 pushState calls
          try {
            if (replace) {
              source.history.replaceState(state, null, to);
            } else {
              source.history.pushState(state, null, to);
            }
          } catch (e) {
            source.location[replace ? "replace" : "assign"](to);
          }

          location = getLocation(source);
          listeners.forEach(listener => listener({ location, action: "PUSH" }));
        }
      };
    }

    // Stores history entries in memory for testing or other platforms like Native
    function createMemorySource(initialPathname = "/") {
      let index = 0;
      const stack = [{ pathname: initialPathname, search: "" }];
      const states = [];

      return {
        get location() {
          return stack[index];
        },
        addEventListener(name, fn) {},
        removeEventListener(name, fn) {},
        history: {
          get entries() {
            return stack;
          },
          get index() {
            return index;
          },
          get state() {
            return states[index];
          },
          pushState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            index++;
            stack.push({ pathname, search });
            states.push(state);
          },
          replaceState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            stack[index] = { pathname, search };
            states[index] = state;
          }
        }
      };
    }

    // Global history uses window.history as the source if available,
    // otherwise a memory history
    const canUseDOM = Boolean(
      typeof window !== "undefined" &&
        window.document &&
        window.document.createElement
    );
    const globalHistory = createHistory(canUseDOM ? window : createMemorySource());
    const { navigate } = globalHistory;

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    const paramRe = /^:(.+)/;

    const SEGMENT_POINTS = 4;
    const STATIC_POINTS = 3;
    const DYNAMIC_POINTS = 2;
    const SPLAT_PENALTY = 1;
    const ROOT_POINTS = 1;

    /**
     * Check if `string` starts with `search`
     * @param {string} string
     * @param {string} search
     * @return {boolean}
     */
    function startsWith(string, search) {
      return string.substr(0, search.length) === search;
    }

    /**
     * Check if `segment` is a root segment
     * @param {string} segment
     * @return {boolean}
     */
    function isRootSegment(segment) {
      return segment === "";
    }

    /**
     * Check if `segment` is a dynamic segment
     * @param {string} segment
     * @return {boolean}
     */
    function isDynamic(segment) {
      return paramRe.test(segment);
    }

    /**
     * Check if `segment` is a splat
     * @param {string} segment
     * @return {boolean}
     */
    function isSplat(segment) {
      return segment[0] === "*";
    }

    /**
     * Split up the URI into segments delimited by `/`
     * @param {string} uri
     * @return {string[]}
     */
    function segmentize(uri) {
      return (
        uri
          // Strip starting/ending `/`
          .replace(/(^\/+|\/+$)/g, "")
          .split("/")
      );
    }

    /**
     * Strip `str` of potential start and end `/`
     * @param {string} str
     * @return {string}
     */
    function stripSlashes(str) {
      return str.replace(/(^\/+|\/+$)/g, "");
    }

    /**
     * Score a route depending on how its individual segments look
     * @param {object} route
     * @param {number} index
     * @return {object}
     */
    function rankRoute(route, index) {
      const score = route.default
        ? 0
        : segmentize(route.path).reduce((score, segment) => {
            score += SEGMENT_POINTS;

            if (isRootSegment(segment)) {
              score += ROOT_POINTS;
            } else if (isDynamic(segment)) {
              score += DYNAMIC_POINTS;
            } else if (isSplat(segment)) {
              score -= SEGMENT_POINTS + SPLAT_PENALTY;
            } else {
              score += STATIC_POINTS;
            }

            return score;
          }, 0);

      return { route, score, index };
    }

    /**
     * Give a score to all routes and sort them on that
     * @param {object[]} routes
     * @return {object[]}
     */
    function rankRoutes(routes) {
      return (
        routes
          .map(rankRoute)
          // If two routes have the exact same score, we go by index instead
          .sort((a, b) =>
            a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
          )
      );
    }

    /**
     * Ranks and picks the best route to match. Each segment gets the highest
     * amount of points, then the type of segment gets an additional amount of
     * points where
     *
     *  static > dynamic > splat > root
     *
     * This way we don't have to worry about the order of our routes, let the
     * computers do it.
     *
     * A route looks like this
     *
     *  { path, default, value }
     *
     * And a returned match looks like:
     *
     *  { route, params, uri }
     *
     * @param {object[]} routes
     * @param {string} uri
     * @return {?object}
     */
    function pick(routes, uri) {
      let match;
      let default_;

      const [uriPathname] = uri.split("?");
      const uriSegments = segmentize(uriPathname);
      const isRootUri = uriSegments[0] === "";
      const ranked = rankRoutes(routes);

      for (let i = 0, l = ranked.length; i < l; i++) {
        const route = ranked[i].route;
        let missed = false;

        if (route.default) {
          default_ = {
            route,
            params: {},
            uri
          };
          continue;
        }

        const routeSegments = segmentize(route.path);
        const params = {};
        const max = Math.max(uriSegments.length, routeSegments.length);
        let index = 0;

        for (; index < max; index++) {
          const routeSegment = routeSegments[index];
          const uriSegment = uriSegments[index];

          if (routeSegment !== undefined && isSplat(routeSegment)) {
            // Hit a splat, just grab the rest, and return a match
            // uri:   /files/documents/work
            // route: /files/* or /files/*splatname
            const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

            params[splatName] = uriSegments
              .slice(index)
              .map(decodeURIComponent)
              .join("/");
            break;
          }

          if (uriSegment === undefined) {
            // URI is shorter than the route, no match
            // uri:   /users
            // route: /users/:userId
            missed = true;
            break;
          }

          let dynamicMatch = paramRe.exec(routeSegment);

          if (dynamicMatch && !isRootUri) {
            const value = decodeURIComponent(uriSegment);
            params[dynamicMatch[1]] = value;
          } else if (routeSegment !== uriSegment) {
            // Current segments don't match, not dynamic, not splat, so no match
            // uri:   /users/123/settings
            // route: /users/:id/profile
            missed = true;
            break;
          }
        }

        if (!missed) {
          match = {
            route,
            params,
            uri: "/" + uriSegments.slice(0, index).join("/")
          };
          break;
        }
      }

      return match || default_ || null;
    }

    /**
     * Check if the `path` matches the `uri`.
     * @param {string} path
     * @param {string} uri
     * @return {?object}
     */
    function match(route, uri) {
      return pick([route], uri);
    }

    /**
     * Add the query to the pathname if a query is given
     * @param {string} pathname
     * @param {string} [query]
     * @return {string}
     */
    function addQuery(pathname, query) {
      return pathname + (query ? `?${query}` : "");
    }

    /**
     * Resolve URIs as though every path is a directory, no files. Relative URIs
     * in the browser can feel awkward because not only can you be "in a directory",
     * you can be "at a file", too. For example:
     *
     *  browserSpecResolve('foo', '/bar/') => /bar/foo
     *  browserSpecResolve('foo', '/bar') => /foo
     *
     * But on the command line of a file system, it's not as complicated. You can't
     * `cd` from a file, only directories. This way, links have to know less about
     * their current path. To go deeper you can do this:
     *
     *  <Link to="deeper"/>
     *  // instead of
     *  <Link to=`{${props.uri}/deeper}`/>
     *
     * Just like `cd`, if you want to go deeper from the command line, you do this:
     *
     *  cd deeper
     *  # not
     *  cd $(pwd)/deeper
     *
     * By treating every path as a directory, linking to relative paths should
     * require less contextual information and (fingers crossed) be more intuitive.
     * @param {string} to
     * @param {string} base
     * @return {string}
     */
    function resolve(to, base) {
      // /foo/bar, /baz/qux => /foo/bar
      if (startsWith(to, "/")) {
        return to;
      }

      const [toPathname, toQuery] = to.split("?");
      const [basePathname] = base.split("?");
      const toSegments = segmentize(toPathname);
      const baseSegments = segmentize(basePathname);

      // ?a=b, /users?b=c => /users?a=b
      if (toSegments[0] === "") {
        return addQuery(basePathname, toQuery);
      }

      // profile, /users/789 => /users/789/profile
      if (!startsWith(toSegments[0], ".")) {
        const pathname = baseSegments.concat(toSegments).join("/");

        return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
      }

      // ./       , /users/123 => /users/123
      // ../      , /users/123 => /users
      // ../..    , /users/123 => /
      // ../../one, /a/b/c/d   => /a/b/one
      // .././one , /a/b/c/d   => /a/b/c/one
      const allSegments = baseSegments.concat(toSegments);
      const segments = [];

      allSegments.forEach(segment => {
        if (segment === "..") {
          segments.pop();
        } else if (segment !== ".") {
          segments.push(segment);
        }
      });

      return addQuery("/" + segments.join("/"), toQuery);
    }

    /**
     * Combines the `basepath` and the `path` into one path.
     * @param {string} basepath
     * @param {string} path
     */
    function combinePaths(basepath, path) {
      return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/`;
    }

    /**
     * Decides whether a given `event` should result in a navigation or not.
     * @param {object} event
     */
    function shouldNavigate(event) {
      return (
        !event.defaultPrevented &&
        event.button === 0 &&
        !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
      );
    }

    /* node_modules\svelte-routing\src\Router.svelte generated by Svelte v3.44.2 */

    function create_fragment$3(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 256)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[8],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[8])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[8], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $location;
    	let $routes;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, ['default']);
    	let { basepath = "/" } = $$props;
    	let { url = null } = $$props;
    	const locationContext = getContext(LOCATION);
    	const routerContext = getContext(ROUTER);
    	const routes = writable([]);
    	validate_store(routes, 'routes');
    	component_subscribe($$self, routes, value => $$invalidate(6, $routes = value));
    	const activeRoute = writable(null);
    	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

    	// If locationContext is not set, this is the topmost Router in the tree.
    	// If the `url` prop is given we force the location to it.
    	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(5, $location = value));

    	// If routerContext is set, the routerBase of the parent Router
    	// will be the base for this Router's descendants.
    	// If routerContext is not set, the path and resolved uri will both
    	// have the value of the basepath prop.
    	const base = routerContext
    	? routerContext.routerBase
    	: writable({ path: basepath, uri: basepath });

    	validate_store(base, 'base');
    	component_subscribe($$self, base, value => $$invalidate(7, $base = value));

    	const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
    		// If there is no activeRoute, the routerBase will be identical to the base.
    		if (activeRoute === null) {
    			return base;
    		}

    		const { path: basepath } = base;
    		const { route, uri } = activeRoute;

    		// Remove the potential /* or /*splatname from
    		// the end of the child Routes relative paths.
    		const path = route.default
    		? basepath
    		: route.path.replace(/\*.*$/, "");

    		return { path, uri };
    	});

    	function registerRoute(route) {
    		const { path: basepath } = $base;
    		let { path } = route;

    		// We store the original path in the _path property so we can reuse
    		// it when the basepath changes. The only thing that matters is that
    		// the route reference is intact, so mutation is fine.
    		route._path = path;

    		route.path = combinePaths(basepath, path);

    		if (typeof window === "undefined") {
    			// In SSR we should set the activeRoute immediately if it is a match.
    			// If there are more Routes being registered after a match is found,
    			// we just skip them.
    			if (hasActiveRoute) {
    				return;
    			}

    			const matchingRoute = match(route, $location.pathname);

    			if (matchingRoute) {
    				activeRoute.set(matchingRoute);
    				hasActiveRoute = true;
    			}
    		} else {
    			routes.update(rs => {
    				rs.push(route);
    				return rs;
    			});
    		}
    	}

    	function unregisterRoute(route) {
    		routes.update(rs => {
    			const index = rs.indexOf(route);
    			rs.splice(index, 1);
    			return rs;
    		});
    	}

    	if (!locationContext) {
    		// The topmost Router in the tree is responsible for updating
    		// the location store and supplying it through context.
    		onMount(() => {
    			const unlisten = globalHistory.listen(history => {
    				location.set(history.location);
    			});

    			return unlisten;
    		});

    		setContext(LOCATION, location);
    	}

    	setContext(ROUTER, {
    		activeRoute,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute
    	});

    	const writable_props = ['basepath', 'url'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('$$scope' in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		setContext,
    		onMount,
    		writable,
    		derived,
    		LOCATION,
    		ROUTER,
    		globalHistory,
    		pick,
    		match,
    		stripSlashes,
    		combinePaths,
    		basepath,
    		url,
    		locationContext,
    		routerContext,
    		routes,
    		activeRoute,
    		hasActiveRoute,
    		location,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute,
    		$location,
    		$routes,
    		$base
    	});

    	$$self.$inject_state = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('hasActiveRoute' in $$props) hasActiveRoute = $$props.hasActiveRoute;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$base*/ 128) {
    			// This reactive statement will update all the Routes' path when
    			// the basepath changes.
    			{
    				const { path: basepath } = $base;

    				routes.update(rs => {
    					rs.forEach(r => r.path = combinePaths(basepath, r._path));
    					return rs;
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*$routes, $location*/ 96) {
    			// This reactive statement will be run when the Router is created
    			// when there are no Routes and then again the following tick, so it
    			// will not find an active Route in SSR and in the browser it will only
    			// pick an active Route after all Routes have been registered.
    			{
    				const bestMatch = pick($routes, $location.pathname);
    				activeRoute.set(bestMatch);
    			}
    		}
    	};

    	return [
    		routes,
    		location,
    		base,
    		basepath,
    		url,
    		$location,
    		$routes,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { basepath: 3, url: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get basepath() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set basepath(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get url() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-routing\src\Route.svelte generated by Svelte v3.44.2 */

    const get_default_slot_changes = dirty => ({
    	params: dirty & /*routeParams*/ 4,
    	location: dirty & /*$location*/ 16
    });

    const get_default_slot_context = ctx => ({
    	params: /*routeParams*/ ctx[2],
    	location: /*$location*/ ctx[4]
    });

    // (40:0) {#if $activeRoute !== null && $activeRoute.route === route}
    function create_if_block(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*component*/ ctx[0] !== null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(40:0) {#if $activeRoute !== null && $activeRoute.route === route}",
    		ctx
    	});

    	return block;
    }

    // (43:2) {:else}
    function create_else_block(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[10].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], get_default_slot_context);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope, routeParams, $location*/ 532)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[9],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[9])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, get_default_slot_changes),
    						get_default_slot_context
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(43:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (41:2) {#if component !== null}
    function create_if_block_1(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{ location: /*$location*/ ctx[4] },
    		/*routeParams*/ ctx[2],
    		/*routeProps*/ ctx[3]
    	];

    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (switch_instance) claim_component(switch_instance.$$.fragment, nodes);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_hydration_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*$location, routeParams, routeProps*/ 28)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*$location*/ 16 && { location: /*$location*/ ctx[4] },
    					dirty & /*routeParams*/ 4 && get_spread_object(/*routeParams*/ ctx[2]),
    					dirty & /*routeProps*/ 8 && get_spread_object(/*routeProps*/ ctx[3])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(41:2) {#if component !== null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$activeRoute*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $activeRoute;
    	let $location;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Route', slots, ['default']);
    	let { path = "" } = $$props;
    	let { component = null } = $$props;
    	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
    	validate_store(activeRoute, 'activeRoute');
    	component_subscribe($$self, activeRoute, value => $$invalidate(1, $activeRoute = value));
    	const location = getContext(LOCATION);
    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(4, $location = value));

    	const route = {
    		path,
    		// If no path prop is given, this Route will act as the default Route
    		// that is rendered if no other Route in the Router is a match.
    		default: path === ""
    	};

    	let routeParams = {};
    	let routeProps = {};
    	registerRoute(route);

    	// There is no need to unregister Routes in SSR since it will all be
    	// thrown away anyway.
    	if (typeof window !== "undefined") {
    		onDestroy(() => {
    			unregisterRoute(route);
    		});
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(13, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ('path' in $$new_props) $$invalidate(8, path = $$new_props.path);
    		if ('component' in $$new_props) $$invalidate(0, component = $$new_props.component);
    		if ('$$scope' in $$new_props) $$invalidate(9, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		onDestroy,
    		ROUTER,
    		LOCATION,
    		path,
    		component,
    		registerRoute,
    		unregisterRoute,
    		activeRoute,
    		location,
    		route,
    		routeParams,
    		routeProps,
    		$activeRoute,
    		$location
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(13, $$props = assign(assign({}, $$props), $$new_props));
    		if ('path' in $$props) $$invalidate(8, path = $$new_props.path);
    		if ('component' in $$props) $$invalidate(0, component = $$new_props.component);
    		if ('routeParams' in $$props) $$invalidate(2, routeParams = $$new_props.routeParams);
    		if ('routeProps' in $$props) $$invalidate(3, routeProps = $$new_props.routeProps);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$activeRoute*/ 2) {
    			if ($activeRoute && $activeRoute.route === route) {
    				$$invalidate(2, routeParams = $activeRoute.params);
    			}
    		}

    		{
    			const { path, component, ...rest } = $$props;
    			$$invalidate(3, routeProps = rest);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		component,
    		$activeRoute,
    		routeParams,
    		routeProps,
    		$location,
    		activeRoute,
    		location,
    		route,
    		path,
    		$$scope,
    		slots
    	];
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { path: 8, component: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get path() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get component() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set component(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-routing\src\Link.svelte generated by Svelte v3.44.2 */
    const file$1 = "node_modules\\svelte-routing\\src\\Link.svelte";

    function create_fragment$1(ctx) {
    	let a;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	let a_levels = [
    		{ href: /*href*/ ctx[0] },
    		{ "aria-current": /*ariaCurrent*/ ctx[2] },
    		/*props*/ ctx[1],
    		/*$$restProps*/ ctx[6]
    	];

    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", { href: true, "aria-current": true });
    			var a_nodes = children(a);
    			if (default_slot) default_slot.l(a_nodes);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_attributes(a, a_data);
    			add_location(a, file$1, 40, 0, 1249);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*onClick*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 32768)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[15],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[15])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null),
    						null
    					);
    				}
    			}

    			set_attributes(a, a_data = get_spread_update(a_levels, [
    				(!current || dirty & /*href*/ 1) && { href: /*href*/ ctx[0] },
    				(!current || dirty & /*ariaCurrent*/ 4) && { "aria-current": /*ariaCurrent*/ ctx[2] },
    				dirty & /*props*/ 2 && /*props*/ ctx[1],
    				dirty & /*$$restProps*/ 64 && /*$$restProps*/ ctx[6]
    			]));
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let ariaCurrent;
    	const omit_props_names = ["to","replace","state","getProps"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let $location;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Link', slots, ['default']);
    	let { to = "#" } = $$props;
    	let { replace = false } = $$props;
    	let { state = {} } = $$props;
    	let { getProps = () => ({}) } = $$props;
    	const { base } = getContext(ROUTER);
    	validate_store(base, 'base');
    	component_subscribe($$self, base, value => $$invalidate(14, $base = value));
    	const location = getContext(LOCATION);
    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(13, $location = value));
    	const dispatch = createEventDispatcher();
    	let href, isPartiallyCurrent, isCurrent, props;

    	function onClick(event) {
    		dispatch("click", event);

    		if (shouldNavigate(event)) {
    			event.preventDefault();

    			// Don't push another entry to the history stack when the user
    			// clicks on a Link to the page they are currently on.
    			const shouldReplace = $location.pathname === href || replace;

    			navigate(href, { state, replace: shouldReplace });
    		}
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(6, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('to' in $$new_props) $$invalidate(7, to = $$new_props.to);
    		if ('replace' in $$new_props) $$invalidate(8, replace = $$new_props.replace);
    		if ('state' in $$new_props) $$invalidate(9, state = $$new_props.state);
    		if ('getProps' in $$new_props) $$invalidate(10, getProps = $$new_props.getProps);
    		if ('$$scope' in $$new_props) $$invalidate(15, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		createEventDispatcher,
    		ROUTER,
    		LOCATION,
    		navigate,
    		startsWith,
    		resolve,
    		shouldNavigate,
    		to,
    		replace,
    		state,
    		getProps,
    		base,
    		location,
    		dispatch,
    		href,
    		isPartiallyCurrent,
    		isCurrent,
    		props,
    		onClick,
    		ariaCurrent,
    		$location,
    		$base
    	});

    	$$self.$inject_state = $$new_props => {
    		if ('to' in $$props) $$invalidate(7, to = $$new_props.to);
    		if ('replace' in $$props) $$invalidate(8, replace = $$new_props.replace);
    		if ('state' in $$props) $$invalidate(9, state = $$new_props.state);
    		if ('getProps' in $$props) $$invalidate(10, getProps = $$new_props.getProps);
    		if ('href' in $$props) $$invalidate(0, href = $$new_props.href);
    		if ('isPartiallyCurrent' in $$props) $$invalidate(11, isPartiallyCurrent = $$new_props.isPartiallyCurrent);
    		if ('isCurrent' in $$props) $$invalidate(12, isCurrent = $$new_props.isCurrent);
    		if ('props' in $$props) $$invalidate(1, props = $$new_props.props);
    		if ('ariaCurrent' in $$props) $$invalidate(2, ariaCurrent = $$new_props.ariaCurrent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*to, $base*/ 16512) {
    			$$invalidate(0, href = to === "/" ? $base.uri : resolve(to, $base.uri));
    		}

    		if ($$self.$$.dirty & /*$location, href*/ 8193) {
    			$$invalidate(11, isPartiallyCurrent = startsWith($location.pathname, href));
    		}

    		if ($$self.$$.dirty & /*href, $location*/ 8193) {
    			$$invalidate(12, isCurrent = href === $location.pathname);
    		}

    		if ($$self.$$.dirty & /*isCurrent*/ 4096) {
    			$$invalidate(2, ariaCurrent = isCurrent ? "page" : undefined);
    		}

    		if ($$self.$$.dirty & /*getProps, $location, href, isPartiallyCurrent, isCurrent*/ 15361) {
    			$$invalidate(1, props = getProps({
    				location: $location,
    				href,
    				isPartiallyCurrent,
    				isCurrent
    			}));
    		}
    	};

    	return [
    		href,
    		props,
    		ariaCurrent,
    		base,
    		location,
    		onClick,
    		$$restProps,
    		to,
    		replace,
    		state,
    		getProps,
    		isPartiallyCurrent,
    		isCurrent,
    		$location,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Link extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			to: 7,
    			replace: 8,
    			state: 9,
    			getProps: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Link",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get to() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set to(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get replace() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replace(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get state() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getProps() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getProps(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.44.2 */
    const file = "src\\App.svelte";

    // (14:2) <Link to="/">
    function create_default_slot_4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Home");
    		},
    		l: function claim(nodes) {
    			t = claim_text(nodes, "Home");
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(14:2) <Link to=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (15:2) <Link to="/products">
    function create_default_slot_3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Shop");
    		},
    		l: function claim(nodes) {
    			t = claim_text(nodes, "Shop");
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(15:2) <Link to=\\\"/products\\\">",
    		ctx
    	});

    	return block;
    }

    // (16:2) <Link to="/about">
    function create_default_slot_2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Our Story");
    		},
    		l: function claim(nodes) {
    			t = claim_text(nodes, "Our Story");
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(16:2) <Link to=\\\"/about\\\">",
    		ctx
    	});

    	return block;
    }

    // (17:2) <Link to="/coffee">
    function create_default_slot_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Our Coffee");
    		},
    		l: function claim(nodes) {
    			t = claim_text(nodes, "Our Coffee");
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(17:2) <Link to=\\\"/coffee\\\">",
    		ctx
    	});

    	return block;
    }

    // (12:0) <Router url="{url}">
    function create_default_slot(ctx) {
    	let nav;
    	let link0;
    	let t0;
    	let link1;
    	let t1;
    	let link2;
    	let t2;
    	let link3;
    	let t3;
    	let main;
    	let route0;
    	let t4;
    	let route1;
    	let t5;
    	let route2;
    	let t6;
    	let route3;
    	let t7;
    	let route4;
    	let current;

    	link0 = new Link({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	link1 = new Link({
    			props: {
    				to: "/products",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	link2 = new Link({
    			props: {
    				to: "/about",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	link3 = new Link({
    			props: {
    				to: "/coffee",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route0 = new Route({
    			props: { path: "/", component: Home },
    			$$inline: true
    		});

    	route1 = new Route({
    			props: { path: "products", component: Products },
    			$$inline: true
    		});

    	route2 = new Route({
    			props: { path: "about", component: About },
    			$$inline: true
    		});

    	route3 = new Route({
    			props: { path: "coffee", component: Coffee },
    			$$inline: true
    		});

    	route4 = new Route({
    			props: { path: "/product/:id", component: Product },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			create_component(link0.$$.fragment);
    			t0 = space();
    			create_component(link1.$$.fragment);
    			t1 = space();
    			create_component(link2.$$.fragment);
    			t2 = space();
    			create_component(link3.$$.fragment);
    			t3 = space();
    			main = element("main");
    			create_component(route0.$$.fragment);
    			t4 = space();
    			create_component(route1.$$.fragment);
    			t5 = space();
    			create_component(route2.$$.fragment);
    			t6 = space();
    			create_component(route3.$$.fragment);
    			t7 = space();
    			create_component(route4.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			nav = claim_element(nodes, "NAV", {});
    			var nav_nodes = children(nav);
    			claim_component(link0.$$.fragment, nav_nodes);
    			t0 = claim_space(nav_nodes);
    			claim_component(link1.$$.fragment, nav_nodes);
    			t1 = claim_space(nav_nodes);
    			claim_component(link2.$$.fragment, nav_nodes);
    			t2 = claim_space(nav_nodes);
    			claim_component(link3.$$.fragment, nav_nodes);
    			nav_nodes.forEach(detach_dev);
    			t3 = claim_space(nodes);
    			main = claim_element(nodes, "MAIN", {});
    			var main_nodes = children(main);
    			claim_component(route0.$$.fragment, main_nodes);
    			t4 = claim_space(main_nodes);
    			claim_component(route1.$$.fragment, main_nodes);
    			t5 = claim_space(main_nodes);
    			claim_component(route2.$$.fragment, main_nodes);
    			t6 = claim_space(main_nodes);
    			claim_component(route3.$$.fragment, main_nodes);
    			t7 = claim_space(main_nodes);
    			claim_component(route4.$$.fragment, main_nodes);
    			main_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(nav, file, 12, 1, 412);
    			add_location(main, file, 19, 1, 573);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, nav, anchor);
    			mount_component(link0, nav, null);
    			append_hydration_dev(nav, t0);
    			mount_component(link1, nav, null);
    			append_hydration_dev(nav, t1);
    			mount_component(link2, nav, null);
    			append_hydration_dev(nav, t2);
    			mount_component(link3, nav, null);
    			insert_hydration_dev(target, t3, anchor);
    			insert_hydration_dev(target, main, anchor);
    			mount_component(route0, main, null);
    			append_hydration_dev(main, t4);
    			mount_component(route1, main, null);
    			append_hydration_dev(main, t5);
    			mount_component(route2, main, null);
    			append_hydration_dev(main, t6);
    			mount_component(route3, main, null);
    			append_hydration_dev(main, t7);
    			mount_component(route4, main, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const link0_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				link0_changes.$$scope = { dirty, ctx };
    			}

    			link0.$set(link0_changes);
    			const link1_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				link1_changes.$$scope = { dirty, ctx };
    			}

    			link1.$set(link1_changes);
    			const link2_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				link2_changes.$$scope = { dirty, ctx };
    			}

    			link2.$set(link2_changes);
    			const link3_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				link3_changes.$$scope = { dirty, ctx };
    			}

    			link3.$set(link3_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(link0.$$.fragment, local);
    			transition_in(link1.$$.fragment, local);
    			transition_in(link2.$$.fragment, local);
    			transition_in(link3.$$.fragment, local);
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			transition_in(route2.$$.fragment, local);
    			transition_in(route3.$$.fragment, local);
    			transition_in(route4.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(link0.$$.fragment, local);
    			transition_out(link1.$$.fragment, local);
    			transition_out(link2.$$.fragment, local);
    			transition_out(link3.$$.fragment, local);
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			transition_out(route2.$$.fragment, local);
    			transition_out(route3.$$.fragment, local);
    			transition_out(route4.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			destroy_component(link0);
    			destroy_component(link1);
    			destroy_component(link2);
    			destroy_component(link3);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(main);
    			destroy_component(route0);
    			destroy_component(route1);
    			destroy_component(route2);
    			destroy_component(route3);
    			destroy_component(route4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(12:0) <Router url=\\\"{url}\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let header;
    	let t0;
    	let router;
    	let t1;
    	let footer;
    	let current;
    	header = new Header({ $$inline: true });

    	router = new Router({
    			props: {
    				url: /*url*/ ctx[0],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(header.$$.fragment);
    			t0 = space();
    			create_component(router.$$.fragment);
    			t1 = space();
    			create_component(footer.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(header.$$.fragment, nodes);
    			t0 = claim_space(nodes);
    			claim_component(router.$$.fragment, nodes);
    			t1 = claim_space(nodes);
    			claim_component(footer.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			mount_component(router, target, anchor);
    			insert_hydration_dev(target, t1, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};
    			if (dirty & /*url*/ 1) router_changes.url = /*url*/ ctx[0];

    			if (dirty & /*$$scope*/ 2) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(router.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(router.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(header, detaching);
    			if (detaching) detach_dev(t0);
    			destroy_component(router, detaching);
    			if (detaching) detach_dev(t1);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { url = "" } = $$props;
    	const writable_props = ['url'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	$$self.$capture_state = () => ({
    		Products,
    		Footer,
    		Header,
    		Product,
    		CartLength,
    		Cart,
    		About,
    		Home,
    		Coffee,
    		Router,
    		Link,
    		Route,
    		products,
    		cart,
    		counter,
    		url
    	});

    	$$self.$inject_state = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [url];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { url: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get url() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	hydrate: true
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
