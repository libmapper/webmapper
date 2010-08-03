
function test_send()
{
    div = document.createElement('div');
    inp = document.createElement('input');
    inp.value = "Send /test,si,asdf,123";
    inp.type = "button";
    inp.onclick = function(){OSC.send('/test', 'si', ['asdf', 123]);}
    div.appendChild(inp);
    document.body.insertBefore(div, document.getElementById('output'));
}

/* The main program. */
function main()
{
    OSC.register("/test", function(path, types, args) {
        trace(path+','+types+",["+args+"]");
    });

    OSC.start();

    test_send();
}

/* Kick things off. */
window.onload = main;
