// eventManager.js
// A simple publish/subscribe system for game events.

const listeners = {};
const history = [];
let debugListener = null;

/**
 * Registers a single callback function to be executed for any event when in debug mode.
 * @param {function} callback - The function to call. It will receive (eventName, payload).
 */
export function registerDebugListener(callback) {
    debugListener = callback;
}

/**
 * Gets the history of the last 10 events.
 * @returns {Array} An array of event objects { name, payload, time }.
 */
export function getEventHistory() {
    return history;
}

/**
 * Subscribes a callback function to a specific event.
 * @param {string} eventName - The name of the event to subscribe to.
 * @param {function} callback - The function to call when the event is dispatched.
 */
export function subscribe(eventName, callback) {
    if (!listeners[eventName]) {
        listeners[eventName] = [];
    }
    listeners[eventName].push(callback);
}

/**
 * Dispatches an event, calling all subscribed callbacks.
 * @param {string} eventName - The name of the event to dispatch.
 * @param {object} payload - The data to pass to the event listeners.
 */
export function dispatch(eventName, payload) {
    // Add to history
    history.unshift({ name: eventName, payload: payload, time: Date.now() });
    if (history.length > 10) {
        history.pop();
    }

    // Trigger debug listener if it exists
    if (debugListener) {
        debugListener(eventName, payload);
    }

    // Trigger regular listeners
    if (!listeners[eventName]) {
        return;
    }
    listeners[eventName].forEach(callback => {
        try {
            callback(payload);
        } catch (error) {
            console.error(`Error in event listener for "${eventName}":`, error);
        }
    });
}

/**
 * Unsubscribes a callback function from a specific event.
 * (Optional but good practice)
 * @param {string} eventName - The name of the event.
 * @param {function} callback - The specific callback to remove.
 */
export function unsubscribe(eventName, callback) {
    if (!listeners[eventName]) {
        return;
    }
    listeners[eventName] = listeners[eventName].filter(
        listener => listener !== callback
    );
}