
/* An object to provide Open Sound Control services by sending
 * asynchronous requests to the server.  It maintains a given number
 * of connections at all times. */
OSC = {
    requests: new Bucket(),
    num_requests: 5,
    request_id: 0,
    handlers: {},
    handler_id: 0,

    message_request: function ()
    {
        OSC.requests.put(OSC.request_id);
        http_request('wait_osc', {'id': OSC.request_id++},
            function (text) {
                if (text.length==0)
                    return;
                var msg = JSON.parse(text);
                if (msg && msg['id']!=null)
                    OSC.requests.take(msg['id']);
                OSC.maintain_requests();
                if (msg['path']) {
                    var hs = OSC.handlers[msg['path']];
                    if (hs) for (h in hs)
                        hs[h](msg['path'], msg['types'], msg['args']);
                }
            });
    },

    /* Called to make sure the required number of connections are
     * still active. */
    maintain_requests: function ()
    {
        while (OSC.requests.contents.length < OSC.num_requests)
            OSC.message_request();
    },

    /* Register a handler for a particular message address. Returns a
     * reference that must be passed to unregister. */
    register: function(address, func)
    {
        var h = OSC.handlers[address];
        if (!h) {
            h = {};
            OSC.handlers[address] = h;
        }
        h[OSC.handler_id] = func;
        return [address, OSC.handler_id++];
    },

    /* Unregister a function.  Parameter may be a reference returned
     * from OSC.register(), or a string containing the message
     * address. */
    unregister: function(handler)
    {
        if (typeof(handler)=="string") {
            delete OSC.handlers[handler];
            return;
        }
        var address = handler[0];
        var id = handler[1];
        var h = OSC.handlers[address];
        if (h[id])
            delete h[id];
        var size = 0;
        for (var key in h)
            if (h.hasOwnProperty(key)) size ++;
        if (size == 0)
            delete OSC.handlers[address];
    },

    /* Start the OSC service. */
    start: function ()
    {
        setTimeout(function() {OSC.maintain_requests();}, 100);
    },

    /* Send a message. */
    send: function (path, types, args)
    {
        http_request('send_osc',
                     {'msg':
                      JSON.stringify({'path': path,
                                      'types': types ? types : '',
                                      'args': args ? args : []})},
                     function () {});
    }
};
