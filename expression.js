var Expression = function(expr_input) {
	this.operator_functions = {
		'^': function(l, r) {
			return Math.pow(l, r);
		},
		'e': function(l, r) {
			return l * Math.pow(10, r);
		},
		'/': function(l, r) {
			return l / r;
		},
		'*': function(l, r) {
			return l * r;
		},
		'-': function(l, r) {
			return l - r;
		},
		'+': function(l, r) {
			return l + r;
		}
	};

	this.operators = Object.keys(this.operator_functions);
	this.left_unary_operators = ['+', '-'];
	this.grouping_operator = '()';

	this.parenthesis_groups = [];

	//this.derivation_epsilon = 0.00001;

	this.tree = null;
	this.expression = expr_input;

	var that = this;

	/* Parsing / Strings helpers */
	function str_replace_between(str, start, end, what) {
	    return str.substring(0, start) + what + str.substring(end);
	}

	function in_array(needle, haystack) {
	    var length = haystack.length;
	    for(var i = 0; i < length; i++) {
	        if(haystack[i] == needle) return true;
	    }
	    return false;
	}

	/* Expression parsing helpers */
	function operator_has_priority(operator, compare_operator) {
		var op_index   = that.operators.indexOf(operator);
		var cpop_index = that.operators.indexOf(compare_operator);

		if( cpop_index > -1 ) {
			if( op_index == -1 ) {
				return false;
			}
			if( op_index <= cpop_index ) {
				return true;
			}
		} else {
			return true;
		}

		return false;
	}

	
	/* Methods */
	this.parse = function(expression) {
		var operatorsPrecedence = this.operators.slice(0);
		operatorsPrecedence.reverse();
		
		var expr = expression.trim().replace(/\s+/g, '');

		// Put parenthesises around tokens with unary operators following another operator
		var left_tokens = operatorsPrecedence.concat(this.grouping_operator[0]);
		var right_tokens = this.left_unary_operators;

		var left_tokens_re_str = left_tokens.map(function(v) { return '\\'+v; }).join('');
		var right_tokens_re_str = right_tokens.map(function(v) { return '\\'+v; }).join('');

		var unary_regexp_str = '(['+left_tokens_re_str+'])(['+right_tokens_re_str+'])([0-9a-zA-Z\.]+)';
		var unary_regexp = new RegExp(unary_regexp_str, "g");
		var unary_match;

		var replaced_expr = expr;

		while( unary_match = unary_regexp.exec(replaced_expr) ) {
			var replace_pos0 = unary_match.index + 1;
			var replace_pos1 = unary_match.index + unary_match[2].length + unary_match[3].length + 1;

			replaced_expr = str_replace_between(replaced_expr, replace_pos0, replace_pos1, '('+unary_match[2]+unary_match[3]+')');
		}

		expr = replaced_expr;

		// Put Parenthesises contents somewhere else for now
		var par_match = (/\(([^\(\)]+)\)/g).exec(expr);

		while( par_match ) {
			var len = par_match[0].length;
			var index = par_match.index;

			expr = str_replace_between(expr, index, index + len, '##GROUP_PAR#'+(this.parenthesis_groups.length)+'##');
			this.parenthesis_groups.push(par_match[1]);
			
			par_match = (/\(([^\(\)]+)\)/).exec(expr);
		}

		// Actual Tree building loop/recursive function
		var build_tree = function(expression) {
			var expr = expression.trim().replace(/\s+/g, '');

			// Finding last occurence of an operator in the expression
			for(var i = 0; i < operatorsPrecedence.length; i++) {
				var pos = expr.lastIndexOf(operatorsPrecedence[i]);

				if( pos > -1 ) {
					var part1 = expr.slice(0, pos).trim();
					var part2 = expr.slice(pos + 1).trim();
					
					var minified_part1_array = part1.split('');
					var minified_part1_last_chr = minified_part1_array.pop();
					var minified_part1_sane = minified_part1_array.join('');

					if( (! part1) && in_array(operatorsPrecedence[i], that.left_unary_operators) ) {
						// Unary operators when left part is empty
						return {
							signed_node: true,
							operator: operatorsPrecedence[i],
							left:  0,
							right: build_tree(part2)
						};

					} else {
						// Regular operators
						return {
							operator: operatorsPrecedence[i],
							left:  build_tree(part1),
							right: build_tree(part2)
						};
					}						
				}
			}

			// Parsing node's parenthesis contents
			var inner_par_match = (/\#\#GROUP_PAR\#([0-9]+)\#\#/).exec(expr);
			if( inner_par_match ) {
				var par_index = inner_par_match[1];
				var par_tree  = build_tree(that.parenthesis_groups[par_index], true);
				return par_tree;
			}

			return expr;
		}

		return build_tree(expr);
	}

	this.calc = function(variables, node) {
		var lval, rval;

		if( node === undefined ) {
			node = this.tree;
		}

		if( variables === undefined ) {
			variables = {};
		}
		
		if( node !== null && typeof node !== 'object' ) {
			return parseFloat(node);
		}

		if( node.left.operator ) {
			lval = this.calc(variables, node.left);
		} else {
			lval = variables[node.left] ? variables[node.left] : node.left;
		}

		if( node.right.operator ) {
			rval = this.calc(variables, node.right);
		} else {
			rval = variables[node.right] ? variables[node.right] : node.right;
		}

		if( this.operator_functions.hasOwnProperty(node.operator) ) {
			return this.operator_functions[node.operator](parseFloat(lval), parseFloat(rval));
		} else {
			console.error('Unrecognized operator: ', node.operator);
		}
	}

	this.to_string = function(node) {
		var lval, rval;

		if( node === undefined ) {
			node = this.tree;
		}

		if( node !== null && typeof node !== 'object' ) {
			return node;
		}

		if( node.left.operator ) {
			lval = this.to_string(node.left);

			if( ! operator_has_priority(node.left.operator, node.operator) ) {
				lval = '(' + lval + ')';
			}
		} else {
			if( node.left.signed_node ) {
				lval = "";
			} else {
				lval = node.left;
			}
		}

		if( node.right.operator ) {
			rval = this.to_string(node.right);

			if( ! operator_has_priority(node.right.operator, node.operator) ) {
				rval = '(' + rval + ')';
			}
		} else {
			rval = node.right;
		}

		if( node.signed_node ) {
			return node.operator + rval;
		} else {
			var spaces = node.operator == 'e' ? '' : ' ';
			return lval + spaces + node.operator + spaces + rval;
		}	
	}

	this.to_canvas_graph = function(canvas, opts) {

		var settings = {

			/* Actual Graph Settings */
			input_variables: [],
			graph_color: '#2529ab',

			/* Rendering Window settings */
			min_x: -10, 
			max_x: 10,
			min_y: -10,
			max_y: 10,
			graph_padding: 30,

			/* Axes rendering settings (draw_axes must be true for them to apply) */
			draw_axes: true,
			show_max_axes_values: true,
			axes_values_offset: 10,
			axes_color: '#aaa',
			axes_text_color: "#666",
			axes_text_font: "15px Arial",
		};

		if( opts !== undefined ) {
			for(var prop in opts) {
				settings[prop] = opts[prop];
			}
		}

		var that = this;
		var ctx = canvas.getContext('2d');
		var cw = canvas.width;
		var ch = canvas.height;
		var w = cw - settings.graph_padding * 2;
		var h = ch - settings.graph_padding * 2;

		ctx.clearRect(0,0,cw,ch);

		var scaleCoords = function(x, y) {
			return {
				x: settings.graph_padding + (x - settings.min_x) / (settings.max_x - settings.min_x) * w,
				y: settings.graph_padding + h - ((y - settings.min_y) / (settings.max_y - settings.min_y) * h)
			};
		}

		var x_step = (settings.max_x - settings.min_x) / w;

		/* Function to render axes */
		var renderAxes = function() {
			ctx.lineWidth = 1;
			ctx.strokeStyle = settings.axes_color;

			var scaled_0_coords = scaleCoords(0, 0);
			var scaled_min_coords = scaleCoords(settings.min_x, settings.min_y);
			var scaled_max_coords = scaleCoords(settings.max_x, settings.max_y);

			// +Y axis
			ctx.beginPath() ;
			ctx.moveTo(scaled_0_coords.x, scaled_0_coords.y) ;
			ctx.lineTo(scaled_0_coords.x, scaled_max_coords.y) ;
			ctx.stroke();

			// -Y axis
			ctx.beginPath() ;
			ctx.moveTo(scaled_0_coords.x, scaled_0_coords.y) ;
			ctx.lineTo(scaled_0_coords.x, scaled_min_coords.y) ;
			ctx.stroke();

			// +X axis
			ctx.beginPath() ;
			ctx.moveTo(scaled_0_coords.x, scaled_0_coords.y) ;
			ctx.lineTo(scaled_max_coords.x, scaled_0_coords.y) ;
			ctx.stroke();

			// -X axis
			ctx.beginPath() ;
			ctx.moveTo(scaled_0_coords.x, scaled_0_coords.y) ;
			ctx.lineTo(scaled_min_coords.x, scaled_0_coords.y) ;
			ctx.stroke();

			// Min/Max X/Y Values
			if( settings.show_max_axes_values ) {
				ctx.font = settings.axes_text_font;
				ctx.fillStyle = settings.axes_text_color;
				
				// +X Value
				ctx.textAlign = "center";
				ctx.fillText(settings.max_x, scaled_max_coords.x, scaled_0_coords.y - settings.axes_values_offset);

				// -X Value
				ctx.textAlign = "center";
				ctx.fillText(settings.min_x, scaled_min_coords.x, scaled_0_coords.y - settings.axes_values_offset);

				// +Y Value
				ctx.textAlign = "left";
				ctx.fillText(settings.max_y, scaled_0_coords.x + settings.axes_values_offset, scaled_max_coords.y);

				// -Y Value
				ctx.textAlign = "left";
				ctx.fillText(settings.min_y, scaled_0_coords.x + settings.axes_values_offset, scaled_min_coords.y);
			}
		}

		/* Function to use when no input variables (y is a constant) */
		var renderConstant = function() {
			var first_point = true;

			ctx.strokeStyle = settings.graph_color;
			ctx.beginPath();

			for (var x = settings.min_x; x <= settings.max_x; x += x_steo) {
				var y = that.calc();
				var scaled_coords = scaleCoords(x, y);

				if(first_point) {
					ctx.moveTo(scaled_coords.x, scaled_coords.y);
					first_point = false ;
				} else {
					ctx.lineTo(scaled_coords.x, scaled_coords.y);
				}
			}
			ctx.stroke();
		}

		/* Function to use when one input variable (y is varying with x as its input) */
		var renderOneVariable = function(input_varname) {
			var first_point = true;
			var vars_object = {};
			vars_object[input_varname] = null;

			ctx.strokeStyle = settings.graph_color;
			ctx.beginPath() ;
			for (var x = settings.min_x; x <= settings.max_x; x += x_step) {
				vars_object[input_varname] = x;
				var y = that.calc(vars_object);
				var scaled_coords = scaleCoords(x, y);

				if(first_point) {
					ctx.moveTo(scaled_coords.x, scaled_coords.y);
					first_point = false ;
				} else {
					ctx.lineTo(scaled_coords.x, scaled_coords.y);
				}
			}
			ctx.stroke();
		}


		/* Rendering Axes if necessary */
		if( settings.draw_axes ) {
			renderAxes();
		}

		/* Selecting function to use for rendering */
		var number_of_inputs = settings.input_variables.length;
		switch( settings.input_variables.length ) {
			case 1:
				renderOneVariable(settings.input_variables[0]);
				break;
			default: 
				renderConstant();
				break;
		}
		
	}
	
	/* "Constructor" */
	this.tree = this.parse(expr_input);
}