
/* Make an asynchronous HTTP request to the browser. */
function http_request(path, args, ok_responder, error_responder) {
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

/* A simple object class to represent a bucket of things that can be
 * put in or taken out. */
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

/* Helper function to trace debug output. */
function trace(text) {
    var out = document.getElementById('output');
    if (out)
        out.innerHTML += '<p>'+text+'</p>\n'
}
