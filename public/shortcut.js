function ShortcutManager()
{
    var me = this;

    this.disabled = false;
    this.shortcuts = {};
    
    this.addshortcut = function(key, callback) {
        if (typeof key === 'number') {
            key = [key];
        }
        for (i in key) {
            if (!(key[i] in this.shortcuts)) {
                this.shortcuts[key[i]] = [];
            }
            this.shortcuts[key[i]].push(callback);
        }
    }

    $(window).keydown(function(e) {
        console.log("Key press: " + e.keyCode);

        var keycode = e.keyCode ? e.keyCode : e.which;
        eventlog("keyboard", "Key press: " + keycode);

        if (keycode in me.shortcuts) {
            event.preventDefault();
            for (var i in me.shortcuts[keycode]) {
                me.shortcuts[keycode][i]();
            }
        }
    });

}
