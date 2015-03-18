/*
 * MetaJS - MetaPlatform project
 *
 * @author Jiri Hybek <jiri.hybek@cryonix.cz> / Cryonix Innovations <www.cryonix.cz>
 * @license MIT
 * 
 * More at http://www.meta-platform.com
 */

//Initialize global meta registry
if(!window.Meta) window.Meta = {};

/*
 * Template builder
 */
window.Meta.Template = function(target, definition){

	var processor = window.Meta.Template.processor(definition);

	return function(data){
		processor.call(target, data);
	}

}

window.Meta.Template._context = function(data, attrs){

	var context = {};

	for(var k in data)
		if(k.substr(0, 1) != "@")
			context[k] = data[k];

	for(var k in attrs)
		context["@" + k] = attrs[k];

	return context;

}

window.Meta.Template._value = function(el, context, key){

	if(key instanceof Function)
		return key.call(el, context);
	else if(key.indexOf("."))
		return window.Meta.Utils.traverse(context, key.split("."));
	else
		return context[key];

}

window.Meta.Template.processor = function(definition){

	//Set defaults
	for(selector in definition || {}){

		if(definition[selector] instanceof Array){
			
			for(var i = 0; i < definition[selector].length; i++)
				if(!(definition[selector][i] instanceof Function))
					definition[selector][i] = window.Meta.Template.text(definition[selector][i]);

		} else {

			if(!(definition[selector] instanceof Function))
				definition[selector] = window.Meta.Template.text(definition[selector]);

		}

	}

	//Define runner
	var runner = function(el, context, processor){

		if(processor instanceof Array)
			for(var i = 0; i < processor.length; i++)
				processor[i].call(el, context);

		else
			processor.call(el, context);

	}

	//Return processing function
	return function(context){

		for(selector in definition || {}){

			if(definition[selector] instanceof Function && definition[selector].runInParentContext){
				definition[selector].call(this, window.Meta.Template._context(context, {
					"selector": selector
				}));

				continue;
			}

			//Check self
			if(selector == "@"){
				runner(this, context, definition[selector]);
				continue;
			}

			var els = this.querySelectorAll(selector);

			//Call processors for each element
			for(var i = 0; i < els.length; i++)
				runner(els.item(i), context, definition[selector]);

		}

	}

}

/*
 * Template processors
 */
window.Meta.Template.html = function(name){

	return function(context){
		this.innerHTML = context[name] || "";
	}

}

window.Meta.Template.text = function(name){

	return function(context){
		this.innerHTML = window.Meta.Utils.sanitizeHtml(context[name]);
	}

}

window.Meta.Template.string = function(pattern){

	var matches = pattern.match(/#\{([a-zA-Z0-9_-]*)\}/g);
	var vars = {};

	for(var m = 0; m < matches.length; m++){
		var name = matches[m].substr(2, matches[m].length - 3);
		vars[name] = new RegExp("#\\{" + name + "\\}", "g");
	}

	return function(context){

		var value = pattern;

		for(var v in vars){
			value = value.replace(vars[v], context[v] || "");
		}

		this.innerHTML = value;
	}

}

window.Meta.Template.fn = function(callback){

	return function(context){
		this.innerHTML = callback.call(this, context);
	}

}

window.Meta.Template.with = function(key, definition){

	var processor = window.Meta.Template.processor(definition);

	return function(context){
		processor.call(this, window.Meta.Template._context(context[key], {
			parent: context
		}));
	}

}

window.Meta.Template.attr = function(name, key){

	return function(context){
		this.setAttribute(name, window.Meta.Template._value(this, context, key));
	}

}

window.Meta.Template.attrIf = function(name, key, empty){

	return function(context){
		
		var value = window.Meta.Template._value(this, context, key);

		if(value)
			this.setAttribute(name, ( empty ? '' : value ) );
		else if(this.hasAttribute(name))
			this.removeAttribute(name);

	}

}

window.Meta.Template.property = function(name, key){

	return function(context){
		this[name] = (key ? window.Meta.Template._value(this, context, key) : context);
	}

}

window.Meta.Template._if = function(definition, exp){

	var processor = window.Meta.Template.processor(definition);

	var f = function(context){
		
		var result = exp.call(this, context);

		if(result){

			//Restore state
			if(this.__ifRegistry && this.__ifRegistry[context["@selector"]]){
				var registry = this.__ifRegistry[context["@selector"]];

				for(var i = 0; i < registry.length; i++)
					if(registry[i].__nextSibling && registry[i].__nextSibling.parentElement == registry[i].__parent)
						registry[i].__parent.insertBefore(registry[i], registry[i].__nextSibling);
					else
						registry[i].__parent.appendChild(registry[i]);

				delete this.__ifRegistry[context["@selector"]];

			}

			//Process children
			var els = this.querySelectorAll(context["@selector"]);

			for(var i = 0; i < els.length; i++)
				processor.call(els.item(i), context);

		} else {

			var els = this.querySelectorAll(context["@selector"]);
			
			if(!this.__ifRegistry)
				this.__ifRegistry = {};

			if(!this.__ifRegistry[context["@selector"]])
				this.__ifRegistry[context["@selector"]] = [];

			for(var i = 0; i < els.length; i++){

				els.item(i).__parent = els.item(i).parentElement;
				els.item(i).__nextSibling = els.item(i).nextSibling;

				this.__ifRegistry[context["@selector"]].push(els.item(i));
				
				els.item(i).parentElement.removeChild(els.item(i));

			}

		}

	}

	f.runInParentContext = true;

	return f;

}

window.Meta.Template.if = function(key, definition){

	return window.Meta.Template._if(definition, function(context){
		return ( window.Meta.Template._value(this, context, key) ? true : false );
	})

}

window.Meta.Template.ifNot = function(key, definition){

	return window.Meta.Template._if(definition, function(context){
		return ( !window.Meta.Template._value(this, context, key) ? true : false );
	})

}

window.Meta.Template.ifLt = function(key, value, definition){

	return window.Meta.Template._if(definition, function(context){
		return ( window.Meta.Template._value(this, context, key) < value ? true : false );
	})

}

window.Meta.Template.ifLte = function(key, value, definition){

	return window.Meta.Template._if(definition, function(context){
		return ( window.Meta.Template._value(this, context, key) <= value ? true : false );
	})

}

window.Meta.Template.ifGt = function(key, value, definition){

	return window.Meta.Template._if(definition, function(context){
		return ( window.Meta.Template._value(this, context, key) > value ? true : false );
	})

}

window.Meta.Template.ifGte = function(key, value, definition){

	return window.Meta.Template._if(definition, function(context){
		return ( window.Meta.Template._value(this, context, key) >= value ? true : false );
	})

}

window.Meta.Template.repeat = function(key, definition){

	var processor = window.Meta.Template.processor(definition);

	var each = function(data, cb){

	}

	var keyMap = function(data){

		var map = [];

		if(data instanceof Array){
			
			for(var i = 0; i < data.length; i++)
				map[i] = data[i];

		} else {

			var x = 0;

			for(var i in data || {}){
				map[x] = i;
				x++;
			}

		}
				
		return map;

	}

	var f = function(context){

		//Create template
		if(!this.__repeatTemplate)
			this.__repeatTemplate = {};

		if(!this.__repeatTemplate[context["@selector"]]){
			
			this.__repeatTemplate[context["@selector"]] = [];

			var els = this.querySelectorAll(context["@selector"]);

			for(var i = 0; i < els.length; i++){
				els.item(i).__parent = els.item(i).parentElement;
				
				this.__repeatTemplate[context["@selector"]].push(els.item(i));
				
				els.item(i).parentElement.removeChild(els.item(i));
			}

		}
		
		//Define lists
		var scope = this;
		var removeStack = [];
		var remainStack = {};
		var lastElement = null;

		//Get items to repeat
		var items = window.Meta.Template._value(this, context, key);
		var map = keyMap(items);

		console.log(map);

		//Revise current items
		var els = this.querySelectorAll(context["@selector"]);

		for(var i = 0; i < els.length; i++){

			var mapIndex = map.indexOf(els.item(i).__id);

			if(mapIndex >= 0){

				if(!remainStack[mapIndex])
					remainStack[mapIndex] = [];

				remainStack[mapIndex].push(els.item(i));

			} else {
				removeStack.push(els.item(i));
			}

		}

		console.log(removeStack, remainStack);

		//Remove old elements
		for(var c = 0; c < removeStack.length; c++)
			removeStack[c].parentElement.removeChild(removeStack[c]);

		delete removeStack;

		//Bind new nodes and reorder old ones
		for(var i = 0; i < map.length; i++){

			if(map[i] instanceof Object)
				var data = map[i];
			else
				var data = items[map[i]];

			if(remainStack[i]){

				for(var r = 0; r < remainStack[i].length; r++){

					if(remainStack[i][r] instanceof HTMLElement)
						processor.call(remainStack[i][r], window.Meta.Template._context(data, {
							parent: context,
							key: i
						}));

					if(remainStack[i][r].previousSibling != lastElement)
						remainStack[i][r].parentElement.appendChild(remainStack[i][r]);

					lastElement = remainStack[i][r];

				}

			} else {

				for(var t = 0; t < scope.__repeatTemplate[context["@selector"]].length; t++){

					var el = scope.__repeatTemplate[context["@selector"]][t].cloneNode(true);
					
					el.__id = map[i];
					scope.__repeatTemplate[context["@selector"]][t].__parent.appendChild(el);

					processor.call(el, window.Meta.Template._context(data, {
						parent: context,
						key: i
					}));

					lastElement = el;

				}

			}

		};

	}

	f.runInParentContext = true;

	return f;

}

/*
 * Template processor aliases
 */
//String processors
window.$__html		= window.Meta.Template.html;
window.$__text		= window.Meta.Template.text;
window.$__string	= window.Meta.Template.string;
window.$__fn		= window.Meta.Template.fn;
//window.$__filter	= window.Meta.Template.filter;

//Attribute processors
window.$__attr		= window.Meta.Template.attr;
window.$__attrIf	= window.Meta.Template.attrIf;
window.$__prop		= window.Meta.Template.property;

//Condition processors
window.$__if 		= window.Meta.Template.if;
window.$__ifNot 	= window.Meta.Template.ifNot;
window.$__ifLt	 	= window.Meta.Template.ifLt;
window.$__ifLte	 	= window.Meta.Template.ifLte;
window.$__ifGt	 	= window.Meta.Template.ifGt;
window.$__ifGte	 	= window.Meta.Template.ifGte;

//Loop processors
window.$__repeat	= window.Meta.Template.repeat;

//Scope processors
window.$__with	= window.Meta.Template.with;