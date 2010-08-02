
function request(path, args, ok_responder, error_responder) {
  var client = new XMLHttpRequest();
  client.onreadystatechange = function() {
    if(this.readyState == 4)
      ok_responder(this.responseText);
    else if (error_responder)
      error_responder(this.responseText);
  }
  a='';
  n=0;
  for (i in args) {
    if (n==0)
      a+='?';
    else
      a+='&';
    a += i + '=' + args[i];
    n++;
  }
  client.open("GET", path+a);
  client.send("");
}

function Bucket() {
    this.contents = [];
    this.put = function(a) {
        this.contents.push(a);
    }
    this.take = function(a) {
        for (i in this.contents) {
            if (this.contents[i]==a) {
                this.contents.splice(i,1);
                return;
            }
        }
    }
}

var g_osc_requests = new Bucket();
var g_num_osc_requests = 10;
var g_osc_request_id = 0;

function trace(text) {
    var out = document.getElementById('output');
    if (out)
        out.innerHTML += '<p>'+text+'</p>\n'
}

function osc_message_request()
{
    g_osc_requests.put(g_osc_request_id);
    request('wait_osc', {'id': g_osc_request_id++},
            function (text) {
                msg = JSON.parse(text);
                if (msg && msg['id']!=null)
                    g_osc_requests.take(msg['id']);
                trace(msg['path']+','+msg['types']+",["+msg['args']+"]");
                maintain_osc_requests();
            });
}

function maintain_osc_requests()
{
    while (g_osc_requests.contents.length < g_num_osc_requests)
        osc_message_request();
}

function test_msg()
{
    setTimeout(function() {maintain_osc_requests();}, 100);
}
