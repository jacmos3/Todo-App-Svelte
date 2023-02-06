
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
        return style.sheet;
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
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
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
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
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
        if (!rules[name]) {
            rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            managed_styles.forEach(info => {
                const { ownerNode } = info.stylesheet;
                // there is no ownerNode if it runs on jsdom.
                if (ownerNode)
                    detach(ownerNode);
            });
            managed_styles.clear();
        });
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
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
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
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
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
        seen_callbacks.clear();
        set_current_component(saved_component);
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

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
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
        else if (callback) {
            callback();
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        const options = { direction: 'both' };
        let config = fn(node, params, options);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = (program.b - t);
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config(options);
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
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
            ctx: [],
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
            if (!is_function(callback)) {
                return noop;
            }
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.55.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
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

    /* src/components/Header.svelte generated by Svelte v3.55.1 */

    const file$4 = "src/components/Header.svelte";

    function create_fragment$4(ctx) {
    	let div2;
    	let div0;
    	let t0;
    	let t1;
    	let t2;
    	let div1;
    	let t3;
    	let t4;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			t0 = text(/*totalTodos*/ ctx[0]);
    			t1 = text(" Total");
    			t2 = space();
    			div1 = element("div");
    			t3 = text(/*remainingTodos*/ ctx[1]);
    			t4 = text(" Remaining");
    			add_location(div0, file$4, 6, 2, 138);
    			attr_dev(div1, "class", "task-count svelte-19kxfxm");
    			add_location(div1, file$4, 7, 2, 170);
    			attr_dev(div2, "class", "app-header svelte-19kxfxm");
    			add_location(div2, file$4, 5, 1, 111);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div1, t3);
    			append_dev(div1, t4);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*totalTodos*/ 1) set_data_dev(t0, /*totalTodos*/ ctx[0]);
    			if (dirty & /*remainingTodos*/ 2) set_data_dev(t3, /*remainingTodos*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
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
    	validate_slots('Header', slots, []);
    	let { totalTodos } = $$props;
    	let { remainingTodos } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (totalTodos === undefined && !('totalTodos' in $$props || $$self.$$.bound[$$self.$$.props['totalTodos']])) {
    			console.warn("<Header> was created without expected prop 'totalTodos'");
    		}

    		if (remainingTodos === undefined && !('remainingTodos' in $$props || $$self.$$.bound[$$self.$$.props['remainingTodos']])) {
    			console.warn("<Header> was created without expected prop 'remainingTodos'");
    		}
    	});

    	const writable_props = ['totalTodos', 'remainingTodos'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('totalTodos' in $$props) $$invalidate(0, totalTodos = $$props.totalTodos);
    		if ('remainingTodos' in $$props) $$invalidate(1, remainingTodos = $$props.remainingTodos);
    	};

    	$$self.$capture_state = () => ({ totalTodos, remainingTodos });

    	$$self.$inject_state = $$props => {
    		if ('totalTodos' in $$props) $$invalidate(0, totalTodos = $$props.totalTodos);
    		if ('remainingTodos' in $$props) $$invalidate(1, remainingTodos = $$props.remainingTodos);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [totalTodos, remainingTodos];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { totalTodos: 0, remainingTodos: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get totalTodos() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set totalTodos(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get remainingTodos() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set remainingTodos(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Form.svelte generated by Svelte v3.55.1 */

    const { console: console_1$3 } = globals;
    const file$3 = "src/components/Form.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let input;
    	let t;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t = space();
    			button = element("button");
    			attr_dev(input, "placeholder", "Add Todo..");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "input-text svelte-3nnisp");
    			attr_dev(input, "name", "");
    			add_location(input, file$3, 12, 2, 324);
    			attr_dev(button, "class", "btn fa-solid fa-plus svelte-3nnisp");
    			add_location(button, file$3, 13, 2, 425);
    			attr_dev(div, "class", "app-form svelte-3nnisp");
    			add_location(div, file$3, 11, 1, 297);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			set_input_value(input, /*newText*/ ctx[0]);
    			append_dev(div, t);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[2]),
    					listen_dev(button, "click", /*created*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*newText*/ 1 && input.value !== /*newText*/ ctx[0]) {
    				set_input_value(input, /*newText*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Form', slots, []);
    	const dispatch = createEventDispatcher();
    	let { newText } = $$props;

    	function created() {
    		console.log("Created");
    		dispatch("created");
    	}

    	$$self.$$.on_mount.push(function () {
    		if (newText === undefined && !('newText' in $$props || $$self.$$.bound[$$self.$$.props['newText']])) {
    			console_1$3.warn("<Form> was created without expected prop 'newText'");
    		}
    	});

    	const writable_props = ['newText'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$3.warn(`<Form> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		newText = this.value;
    		$$invalidate(0, newText);
    	}

    	$$self.$$set = $$props => {
    		if ('newText' in $$props) $$invalidate(0, newText = $$props.newText);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		newText,
    		created
    	});

    	$$self.$inject_state = $$props => {
    		if ('newText' in $$props) $$invalidate(0, newText = $$props.newText);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [newText, created, input_input_handler];
    }

    class Form extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { newText: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Form",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get newText() {
    		throw new Error("<Form>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set newText(value) {
    		throw new Error("<Form>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/components/Todo.svelte generated by Svelte v3.55.1 */

    const { console: console_1$2 } = globals;
    const file$2 = "src/components/Todo.svelte";

    function create_fragment$2(ctx) {
    	let li;
    	let span1;
    	let button0;
    	let button0_class_value;
    	let t0;
    	let span0;
    	let t1;
    	let t2;
    	let button1;
    	let li_class_value;
    	let li_transition;
    	let current;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			li = element("li");
    			span1 = element("span");
    			button0 = element("button");
    			t0 = space();
    			span0 = element("span");
    			t1 = text(/*itemText*/ ctx[0]);
    			t2 = space();
    			button1 = element("button");
    			attr_dev(button0, "class", button0_class_value = "btn btn-done fa-solid " + (/*completed*/ ctx[1] ? 'fa-square-check' : 'fa-square') + "" + " svelte-1ey1b3b");
    			add_location(button0, file$2, 25, 8, 636);
    			add_location(span0, file$2, 29, 8, 816);
    			add_location(span1, file$2, 24, 4, 621);
    			attr_dev(button1, "class", "btn btn-delete fa-solid fa-trash svelte-1ey1b3b");
    			add_location(button1, file$2, 31, 4, 856);
    			attr_dev(li, "class", li_class_value = "todo-list list-item-view " + (/*completed*/ ctx[1] ? 'completed' : '') + " svelte-1ey1b3b");
    			add_location(li, file$2, 23, 0, 506);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, span1);
    			append_dev(span1, button0);
    			append_dev(span1, t0);
    			append_dev(span1, span0);
    			append_dev(span0, t1);
    			append_dev(li, t2);
    			append_dev(li, button1);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[5], false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*completed*/ 2 && button0_class_value !== (button0_class_value = "btn btn-done fa-solid " + (/*completed*/ ctx[1] ? 'fa-square-check' : 'fa-square') + "" + " svelte-1ey1b3b")) {
    				attr_dev(button0, "class", button0_class_value);
    			}

    			if (!current || dirty & /*itemText*/ 1) set_data_dev(t1, /*itemText*/ ctx[0]);

    			if (!current || dirty & /*completed*/ 2 && li_class_value !== (li_class_value = "todo-list list-item-view " + (/*completed*/ ctx[1] ? 'completed' : '') + " svelte-1ey1b3b")) {
    				attr_dev(li, "class", li_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!li_transition) li_transition = create_bidirectional_transition(li, fly, { y: 200, duration: 2000 }, true);
    				li_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!li_transition) li_transition = create_bidirectional_transition(li, fly, { y: 200, duration: 2000 }, false);
    			li_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			if (detaching && li_transition) li_transition.end();
    			mounted = false;
    			run_all(dispose);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Todo', slots, []);
    	let { itemText } = $$props;
    	let { completed } = $$props;
    	let { itemId } = $$props;
    	const dispatch = createEventDispatcher();

    	function clickDelete(id) {
    		console.log("deleting");
    		dispatch("deleted", { id });
    	}

    	function clickComplete(id) {
    		console.log(id);
    		dispatch("compl", { id, hey: "hey" });
    	}

    	$$self.$$.on_mount.push(function () {
    		if (itemText === undefined && !('itemText' in $$props || $$self.$$.bound[$$self.$$.props['itemText']])) {
    			console_1$2.warn("<Todo> was created without expected prop 'itemText'");
    		}

    		if (completed === undefined && !('completed' in $$props || $$self.$$.bound[$$self.$$.props['completed']])) {
    			console_1$2.warn("<Todo> was created without expected prop 'completed'");
    		}

    		if (itemId === undefined && !('itemId' in $$props || $$self.$$.bound[$$self.$$.props['itemId']])) {
    			console_1$2.warn("<Todo> was created without expected prop 'itemId'");
    		}
    	});

    	const writable_props = ['itemText', 'completed', 'itemId'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<Todo> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => clickComplete(itemId);
    	const click_handler_1 = () => clickDelete(itemId);

    	$$self.$$set = $$props => {
    		if ('itemText' in $$props) $$invalidate(0, itemText = $$props.itemText);
    		if ('completed' in $$props) $$invalidate(1, completed = $$props.completed);
    		if ('itemId' in $$props) $$invalidate(2, itemId = $$props.itemId);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		fly,
    		itemText,
    		completed,
    		itemId,
    		dispatch,
    		clickDelete,
    		clickComplete
    	});

    	$$self.$inject_state = $$props => {
    		if ('itemText' in $$props) $$invalidate(0, itemText = $$props.itemText);
    		if ('completed' in $$props) $$invalidate(1, completed = $$props.completed);
    		if ('itemId' in $$props) $$invalidate(2, itemId = $$props.itemId);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		itemText,
    		completed,
    		itemId,
    		clickDelete,
    		clickComplete,
    		click_handler,
    		click_handler_1
    	];
    }

    class Todo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { itemText: 0, completed: 1, itemId: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Todo",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get itemText() {
    		throw new Error("<Todo>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set itemText(value) {
    		throw new Error("<Todo>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get completed() {
    		throw new Error("<Todo>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set completed(value) {
    		throw new Error("<Todo>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get itemId() {
    		throw new Error("<Todo>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set itemId(value) {
    		throw new Error("<Todo>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Todos.svelte generated by Svelte v3.55.1 */

    const { console: console_1$1 } = globals;
    const file$1 = "src/components/Todos.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (19:8) { #each todos as todo }
    function create_each_block(ctx) {
    	let todo;
    	let current;

    	todo = new Todo({
    			props: {
    				itemId: /*todo*/ ctx[4].id,
    				itemText: /*todo*/ ctx[4].text,
    				completed: /*todo*/ ctx[4].completed
    			},
    			$$inline: true
    		});

    	todo.$on("compl", /*forward*/ ctx[1]);
    	todo.$on("deleted", /*deleted_handler*/ ctx[2]);

    	const block = {
    		c: function create() {
    			create_component(todo.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(todo, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const todo_changes = {};
    			if (dirty & /*todos*/ 1) todo_changes.itemId = /*todo*/ ctx[4].id;
    			if (dirty & /*todos*/ 1) todo_changes.itemText = /*todo*/ ctx[4].text;
    			if (dirty & /*todos*/ 1) todo_changes.completed = /*todo*/ ctx[4].completed;
    			todo.$set(todo_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(todo.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(todo.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(todo, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(19:8) { #each todos as todo }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div;
    	let ul;
    	let current;
    	let each_value = /*todos*/ ctx[0];
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
    			div = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "svelte-1ysmtj7");
    			add_location(ul, file$1, 17, 4, 588);
    			attr_dev(div, "class", "app-body svelte-1ysmtj7");
    			add_location(div, file$1, 16, 0, 561);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*todos, forward*/ 3) {
    				each_value = /*todos*/ ctx[0];
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
    						each_blocks[i].m(ul, null);
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
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Todos', slots, []);
    	let { todos } = $$props;

    	//this is not mandatory, since if we do not intercept it here, it will be intercepted by the parent by default.
    	const dispatch = createEventDispatcher();

    	//this is not mandatory, since if we do not intercept it here, it will be intercepted by the parent by default.
    	function forward(event) {
    		console.log("In todos: ", event.detail);
    		dispatch("compl", event.detail);
    	}

    	$$self.$$.on_mount.push(function () {
    		if (todos === undefined && !('todos' in $$props || $$self.$$.bound[$$self.$$.props['todos']])) {
    			console_1$1.warn("<Todos> was created without expected prop 'todos'");
    		}
    	});

    	const writable_props = ['todos'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Todos> was created with unknown prop '${key}'`);
    	});

    	function deleted_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('todos' in $$props) $$invalidate(0, todos = $$props.todos);
    	};

    	$$self.$capture_state = () => ({
    		Todo,
    		createEventDispatcher,
    		todos,
    		dispatch,
    		forward
    	});

    	$$self.$inject_state = $$props => {
    		if ('todos' in $$props) $$invalidate(0, todos = $$props.todos);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [todos, forward, deleted_handler];
    }

    class Todos extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { todos: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Todos",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get todos() {
    		throw new Error("<Todos>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set todos(value) {
    		throw new Error("<Todos>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.55.1 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let div;
    	let header;
    	let t0;
    	let todos_1;
    	let t1;
    	let form;
    	let updating_newText;
    	let current;

    	header = new Header({
    			props: {
    				totalTodos: /*totalTodos*/ ctx[2],
    				remainingTodos: /*remainingTodos*/ ctx[3]
    			},
    			$$inline: true
    		});

    	todos_1 = new Todos({
    			props: { todos: /*todos*/ ctx[0] },
    			$$inline: true
    		});

    	todos_1.$on("compl", /*onComplete*/ ctx[4]);
    	todos_1.$on("deleted", /*onDelete*/ ctx[5]);

    	function form_newText_binding(value) {
    		/*form_newText_binding*/ ctx[7](value);
    	}

    	let form_props = {};

    	if (/*newText*/ ctx[1] !== void 0) {
    		form_props.newText = /*newText*/ ctx[1];
    	}

    	form = new Form({ props: form_props, $$inline: true });
    	binding_callbacks.push(() => bind(form, 'newText', form_newText_binding));
    	form.$on("created", /*createdTodo*/ ctx[6]);

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(header.$$.fragment);
    			t0 = space();
    			create_component(todos_1.$$.fragment);
    			t1 = space();
    			create_component(form.$$.fragment);
    			attr_dev(div, "id", "app-container");
    			attr_dev(div, "class", "app-container svelte-1h80ln7");
    			add_location(div, file, 56, 0, 1267);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(header, div, null);
    			append_dev(div, t0);
    			mount_component(todos_1, div, null);
    			append_dev(div, t1);
    			mount_component(form, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const header_changes = {};
    			if (dirty & /*totalTodos*/ 4) header_changes.totalTodos = /*totalTodos*/ ctx[2];
    			if (dirty & /*remainingTodos*/ 8) header_changes.remainingTodos = /*remainingTodos*/ ctx[3];
    			header.$set(header_changes);
    			const todos_1_changes = {};
    			if (dirty & /*todos*/ 1) todos_1_changes.todos = /*todos*/ ctx[0];
    			todos_1.$set(todos_1_changes);
    			const form_changes = {};

    			if (!updating_newText && dirty & /*newText*/ 2) {
    				updating_newText = true;
    				form_changes.newText = /*newText*/ ctx[1];
    				add_flush_callback(() => updating_newText = false);
    			}

    			form.$set(form_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(todos_1.$$.fragment, local);
    			transition_in(form.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(todos_1.$$.fragment, local);
    			transition_out(form.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(header);
    			destroy_component(todos_1);
    			destroy_component(form);
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
    	let newText;
    	let totalTodos;
    	let remainingTodos;
    	newText = "blah";

    	let todos = [
    		{ id: 1, text: "First", completed: false },
    		{ id: 2, text: "Second", completed: true },
    		{ id: 3, text: "Third", completed: true }
    	];

    	function onComplete(event) {
    		let updateId = event.detail.id;
    		console.log("Completing", updateId);

    		todos.map(todo => {
    			if (todo.id == updateId) {
    				todo.completed = !todo.completed;
    			}
    		});

    		//this is triggers the activity
    		$$invalidate(0, todos);
    	}

    	function onDelete(event) {
    		let delId = event.detail.id;
    		console.log("deleting", delId);

    		$$invalidate(0, todos = todos.filter(todo => {
    			return todo.id != delId;
    		}));
    	}

    	function createdTodo() {
    		console.log("createdTodo called");

    		if (newText != "") {
    			let newId = Math.max(...todos.map(e => e.id)) + 1;

    			$$invalidate(0, todos = [
    				...todos,
    				{
    					id: newId,
    					text: newText,
    					completed: false
    				}
    			]);
    		}

    		//todos.push({id: todos.length+1, text: newText, completed: false});
    		//todos = todos;
    		$$invalidate(1, newText = "");
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function form_newText_binding(value) {
    		newText = value;
    		$$invalidate(1, newText);
    	}

    	$$self.$capture_state = () => ({
    		Header,
    		Form,
    		Todos,
    		newText,
    		totalTodos,
    		remainingTodos,
    		todos,
    		onComplete,
    		onDelete,
    		createdTodo
    	});

    	$$self.$inject_state = $$props => {
    		if ('newText' in $$props) $$invalidate(1, newText = $$props.newText);
    		if ('totalTodos' in $$props) $$invalidate(2, totalTodos = $$props.totalTodos);
    		if ('remainingTodos' in $$props) $$invalidate(3, remainingTodos = $$props.remainingTodos);
    		if ('todos' in $$props) $$invalidate(0, todos = $$props.todos);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*todos*/ 1) {
    			$$invalidate(3, remainingTodos = todos.reduce(
    				(n, todo) => {
    					return n + (todo.completed ? 0 : 1);
    				},
    				0
    			));
    		}

    		if ($$self.$$.dirty & /*todos*/ 1) {
    			$$invalidate(2, totalTodos = todos.length);
    		}
    	};

    	return [
    		todos,
    		newText,
    		totalTodos,
    		remainingTodos,
    		onComplete,
    		onDelete,
    		createdTodo,
    		form_newText_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'buddy'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
