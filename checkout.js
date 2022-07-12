/* global wc_checkout_params */
jQuery(function($) {
  // wc_checkout_params is required to continue, ensure the object exists
  if (typeof wc_checkout_params === 'undefined') {
    return false;
  }

  // $.blockUI.defaults.overlayCSS.cursor = 'default';
  function check_phone_valid(){
    var phone_valid = true;
            
      if (
        !$("#shipping_phone").intlTelInput("isValidNumber") &&
        $("#shipping_phone").intlTelInput("getNumberType") !== 1
      ) {
        phone_valid = false;
      }
  
      //validate country code
      var phone = $("#shipping_phone").intlTelInput("getNumber");
      if(phone){
        phone = phone.replace(/\s/g, "")
      }
      var allowed_countries = [];
      var allowed_country_codes = [];
      if(typeof preferredCountries != "undefined" && preferredCountries){
        allowed_countries = preferredCountries.split(",")
      } else {
        allowed_countries [baseCountry]
      }
  
      for(var i=0;i<allowed_countries.length;i++){
        if(allowed_countries[i] == "AE"){
          allowed_country_codes.push("+971")
        } else if(allowed_countries[i] == "BH"){
          allowed_country_codes.push("+973")
        } else if(allowed_countries[i] == "EG"){
          allowed_country_codes.push("+20")
        } else if(allowed_countries[i] == "OM"){
          allowed_country_codes.push("+968")
        } else if(allowed_countries[i] == "SA"){
          allowed_country_codes.push("+966")
        }
      }
  
      // if there is any allowed country code present, check if the phone number has the correct country code
      if(allowed_country_codes.length > 0){
        var code_matched = false;
        for(var j=0;j<allowed_country_codes.length;j++){
          if(phone.substr(0,allowed_country_codes[j].length) === allowed_country_codes[j]){
            code_matched = true
            break;
          }
        }
        if(!code_matched){
          phone_valid = false
        }
      }
  
      if(phone.indexOf("undefined") !== -1){
        phone_valid = false;
      }
      
      if($("#shipping_phone").intlTelInput("getValidationError") === 4){
        $("#shipping_phone_field .selected-flag .iti-flag").addClass(baseCountry.toLowerCase())
      }
  
      return phone_valid
  }

  var wc_checkout_form = {
    updateTimer: false,
    dirtyInput: false,
    xhr: false,
    $order_review: $('#order_review'),
    $checkout_form: $('form.checkout'),
    init: function() {
      $(document.body).bind('update_checkout', this.update_checkout);
      // $('.airmile-field').on('click', 'label', this.show_airmile);
      // Payment methods
      this.$checkout_form.on(
        'click',
        'input[name="payment_method"]',
        this.payment_method_selected
      );

      if ($(document.body).hasClass('woocommerce-order-pay')) {
        this.$order_review.on(
          'click',
          'input[name="payment_method"]',
          this.payment_method_selected
        );
      }

      // Form submission
      this.$checkout_form.on('submit', this.submit);

      // Inline validation
      this.$checkout_form.on(
        'blur change',
        '.input-text, select, input:checkbox',
        this.validate_field
      );

      $(document).on('focus.cvv','input',function(){
        wc_checkout_form.input_focused = true
        $(document).off('focus.cvv')
      })

      function cvv_scroll(){
        setTimeout(function(){
          if(!wc_checkout_form.input_focused && $(".checkout-wrp.hide").length == 0){
            setTimeout(function(){ $(".card_cvv input", $(".card_to_use:checked").closest(".saved_card")).focus(); },1000)
            $(window).off('scroll.cvv')
            $(document).off('touchmove.cvv')
          }
        })
      }

      $(window).on('scroll.cvv', cvv_scroll)
      $(document).on('touchmove.cvv', cvv_scroll)

      // Manual trigger
      // this.$checkout_form.on( 'update', this.trigger_update_checkout );

      // Inputs/selects which update totals
      this.$checkout_form.on(
        'change',
        'select.shipping_method, input[name^="shipping_method"], #ship-to-different-address input, .update_totals_on_change select, .update_totals_on_change input[type="radio"],#migsvpc_server_cc_owner',
        this.trigger_update_checkout
      );
      this.$checkout_form.on(
        'change',
        '.address-field select',
        this.input_changed
      );
      this.$checkout_form.on(
        'change',
        'input[name="card_to_use"]',
        this.saved_card_changed
      );
      
      $(document).on('saved_card_changed', this.saved_card_changed);
      this.saved_card_changed()
      this.$checkout_form.on(
        'change',
        '.address-field input.input-text, .update_totals_on_change input.input-text',
        this.maybe_input_changed
      );
      this.$checkout_form.on(
        'change keydown',
        '.address-field input.input-text, .update_totals_on_change input.input-text',
        this.queue_update_checkout
      );

      // Address fields
      this.$checkout_form.on(
        'change',
        '#ship-to-different-address input',
        this.ship_to_different_address
      );

      this.$checkout_form.on("blur",".input-text.card_cvv_input",this.selected_card_validation)

      // Trigger events
      this.$checkout_form.find('#ship-to-different-address input').change();
      this.init_payment_methods();

      // Update on page load
      if (wc_checkout_params.is_checkout === '1') {
        this.init_checkout()
      }
      if (wc_checkout_params.option_guest_checkout === 'yes') {
        $('input#createaccount')
          .change(this.toggle_create_account)
          .change();
      }

      this.$checkout_form.on("change keyup mouseup", "#shipping_phone",  this.check_phone_number);
      this.$checkout_form.on("change keyup mouseup", "#shipping_phone,#shipping_first_name,#shipping_last_name,#shipping_address_1",  this.validate_field);
      this.$checkout_form.on("change", "#shipping_state,#shipping_city",  this.check_select2_field);
      
      this.$checkout_form.on("click", ".intl-tel-input", this.check_phone_number);
    },
    check_select2_field: function(){
      var fields = ['#shipping_state','#shipping_city']
      for(var i=0;i<fields.length;i++){
        var field = $(fields[i])
        if(!field.val()){
          field.closest('.form-row').addClass('empty-value')
        } else {
          field.closest('.form-row').removeClass('empty-value')
        }
      }
    },
    check_phone_number: function(){
      var full_phone = $("#shipping_phone").intlTelInput("getNumber");
      var tmp_full_phone = full_phone

      // set dd country code from input

      if (tmp_full_phone.replace(/[^\+]/g, "").length > 1 && full_phone.indexOf("undefined") === -1) {
          var last_plus = full_phone.lastIndexOf("+")
          full_phone = full_phone.substr(last_plus)

          $("#shipping_phone").intlTelInput("setNumber", full_phone);

      }

    },
    init_payment_methods: function(selectedPaymentMethod) {
      var $payment_methods = $('.woocommerce-checkout').find(
        'input[name="payment_method"]'
      );

      // If there is one method, we can hide the radio input
      if (1 === $payment_methods.length) {
        $payment_methods.eq(0).hide();
      }

      // If there was a previously selected method, check that one.
      if (selectedPaymentMethod) {
        $('#' + selectedPaymentMethod).prop('checked', true);
      }

      // If there are none selected, select the first.
      if (0 === $payment_methods.filter(':checked').length) {
        $payment_methods.eq(0).prop('checked', true);
      }

      // Trigger click event for selected method
      $payment_methods
        .filter(':checked')
        .eq(0)
        .trigger('click');
    },
    get_payment_method: function() {
      //	return wc_checkout_form.$order_review.find( 'input[name="payment_method"]:checked' ).val();
      return $('.wc_payment_methods')
        .find('input[name="payment_method"]:checked')
        .val();
    },
    payment_method_selected: function() {
      if ($('.payment_methods input.input-radio').length > 1) {
        var target_payment_box = $('div.payment_box.' + $(this).attr('ID'));

        if ($(this).is(':checked') && !target_payment_box.is(':visible')) {
          $('div.payment_box')
            .filter(':visible')
            .slideUp(450);

          if ($(this).is(':checked')) {
            $('div.payment_box.' + $(this).attr('ID')).slideDown(450);
          }
          $('.payit-fields').find('.mobile-fields').removeClass('woocommerce-invalid woocommerce-invalid-required-field');

          if($(this).attr('ID') === "payment_method_sdg_applepay"){
            addApplePayOrderBtn();          
          } else {
            if(typeof removeApplePayOrderBtn !== 'undefined') {
              removeApplePayOrderBtn();
            }          
          }

          // $("button#place_order").removeProp('disabled');
          if($(this).attr('ID') === "payment_method_sdg_payit"){
            var otp_val = $('#payit_otp').val();
            otp_val = otp_val.trim();

            if(otp_val && otp_val.length > 0 && otp_val.length == 6){
              enableOrderBtn();
              // $("button#place_order").removeProp('disabled');                      
            } else {
              disableOrderBtn();
              // $("button#place_order").prop('disabled','disabled');              
            }
          } else {
            if($('#payment_method_sdg_payit').length != 0){
              enableOrderBtn();          
            }
          }
        }
      } else {
        $('div.payment_box').show();
      }

      if ($(this).data('order_button_text')) {
        $('#place_order').val($(this).data('order_button_text'));
      } else {
        $('#place_order').val($('#place_order').data('value'));
      }
    },
    toggle_create_account: function() {
      $('div.create-account').hide();

      if ($(this).is(':checked')) {
        $('div.create-account').slideDown();
      }
    },
    /* show_airmile: function() {
      if ($(this).hasClass('active')) {
        $(this).removeClass('active');
        $('.shipping_airmile input').hide();
      } else {
        $('.shipping_airmile input').show();
        $(this).addClass('active');
      }
    },*/
    init_checkout: function() {
      if($("#shipping_phone").length > 0) {
        var parent  = this
      // blocking the ui until  intlTelInputUtils is async loaded
      $.blockUI({
        message:
          ' <div class="sdg-perloader" style="width:62px;position:absolute;top:50%;"><span style="width:40px;height:40px;display:inline-block;position:relative;text-align:initial;border-color:#ffa619;border-width:3px;border-top-color:transparent;margin-right: 0;" class="sdg-spinner"></span>Loading</div>',
        css: { padding: "20px", border: 0 },
        overlayCSS: { background: "#fff", opacity: 0.6 },
      });
      
      var utilsLoaded = setInterval(function(){
        if ( typeof intlTelInputUtils != "undefined") {
          clearInterval(utilsLoaded)
          parent.check_phone_number()
          var phone = $("#shipping_phone").intlTelInput("getNumber")
          if(phone.length > 5){
            $("#shipping_phone").trigger("change")
          }
          parent.$checkout_form
          .on('change','#ms_addresses', function(){
            $("#shipping_phone").trigger("change")
          })
          parent.check_select2_field()
          $.unblockUI()
        }
      },200)
    }
      $('#billing_country, #shipping_country, .country_to_state').change();
      $(document.body).trigger('update_checkout');
    },
    maybe_input_changed: function(e) {
      if (wc_checkout_form.dirtyInput) {
        wc_checkout_form.input_changed(e);
      }
    },
    input_changed: function(e) {
      wc_checkout_form.dirtyInput = e.target;
      wc_checkout_form.maybe_update_checkout();
    },
    selected_card_validation: function(){
      $input = $('input[name="card_to_use"]:checked')
            $card_cvv = $(".card_cvv_input",$input.closest('.saved_card'))
            if( $card_cvv.val() == ''){
               $card_cvv.parents('.form-row').addClass('has-error');
            }
            if(!isCVCValid($card_cvv.val())){
              $card_cvv.parents('.form-row').addClass('has-error');
            } else {
              $card_cvv.parents('.form-row').removeClass('has-error');
            }
    },
    saved_card_changed: function(e) {
      var bin = $(".card_to_use:checked").data("bin")
      if( $(".card_to_use:checked").val() == 'new_card'){
        $(".saved_card.add").hide()
      } else {
        $(".saved_card.add").show()
      }
    
      $(".card_cvv input", $(".card_to_use:checked").closest(".saved_card")).focus()
      
      var bin_check_timer = setInterval(function(){
        if(!(wc_checkout_form.xhr && wc_checkout_form.xhr.readyState == 1)){
          clearTimeout(bin_check_timer)
          $("#cko-card-bin").val(bin).trigger('change');
        }
      }, 100);
      $(".saved_card .card_cvv").removeClass('has-error')
      var flexi_container = $(".flexi_container").detach()
      if($(".card_to_use:checked").val() && $(".card_to_use:checked").val() != 'new_card'){
        $("#stored_flexi_container").html(flexi_container)
      } else {
        $("#flexi-pay-wrap").html(flexi_container)
      }
    },
    queue_update_checkout: function(e) {
      var code = e.keyCode || e.which || 0;

      if (code === 9) {
        return true;
      }

      wc_checkout_form.dirtyInput = this;
      wc_checkout_form.reset_update_checkout_timer();
      wc_checkout_form.updateTimer = setTimeout(
        wc_checkout_form.maybe_update_checkout,
        '1000'
      );
    },
    trigger_update_checkout: function() {
      wc_checkout_form.reset_update_checkout_timer();
      wc_checkout_form.dirtyInput = false;
      $(document.body).trigger('update_checkout');
    },
    maybe_update_checkout: function() {
      var update_totals = true;

      if ($(wc_checkout_form.dirtyInput).length) {
        var $required_inputs = $(wc_checkout_form.dirtyInput)
          .closest('div')
          .find('.address-field.validate-required');

        if ($required_inputs.length) {
          $required_inputs.each(function() {
            if (
              $(this)
                .find('input.input-text')
                .val() === ''
            ) {
              update_totals = false;
            }
          });
        }
      }
      if (update_totals) {
        wc_checkout_form.trigger_update_checkout();
      }
    },
    ship_to_different_address: function() {
      // alert($('input.shipping_method:checked').val());
      if ($('input.shipping_method:checked').val() == 'local_pickup_plus') {
        $('select.pickup_location').select2();
        // $('select.pickup_location').selectric();
        // $( '#shipping_country').prop("disabled",true).selectric('refresh');

        // $( '#shipping_state').prop("disabled",true).selectric('refresh');
        $('#shipping_first_name').prop('disabled', true);
        $('#shipping_last_name').prop('disabled', true);
        $('#shipping_address_1').prop('disabled', true);
        $('#shipping_city').prop('disabled', true);
        // alert($("#billing_country:first").val())
      }
      /* $('div.shipping_address').hide();
      if ($(this).is(':checked')) {
        $('div.shipping_address').slideDown();
      }*/
    },
    reset_update_checkout_timer: function() {
      clearTimeout(wc_checkout_form.updateTimer);
    },
    validate_field: function() {
      var $this = $(this),
        $parent = $this.closest('.form-row'),
        validated = true;

      if ($parent.is('.validate-required')) {
        if ('checkbox' === $this.attr('type') && !$this.is(':checked')) {
          $parent
            .removeClass('woocommerce-validated')
            .addClass('woocommerce-invalid woocommerce-invalid-required-field');
          validated = false;
        } else if (
          $this.val() === '' &&
          $this.attr('id') !== 'shipping_phone'
        ) {
          $parent
            .removeClass('woocommerce-validated')
            .addClass('woocommerce-invalid woocommerce-invalid-required-field');
          validated = false;
        } else if ($this.attr('id') == 'shipping_phone') {
          if(check_phone_valid()){
            validated = true
          } else {
            $parent
            .removeClass('woocommerce-validated')
            .addClass('woocommerce-invalid woocommerce-invalid-required-field');
            validated = false;
          }
        }
      }

      if ($parent.is('.validate-email')) {
        if ($this.val()) {
          /* https://stackoverflow.com/questions/2855865/jquery-validate-e-mail-address-regex */
          var pattern = new RegExp(
            /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?$/i
          );

          if (!pattern.test($this.val())) {
            $parent
              .removeClass('woocommerce-validated')
              .addClass('woocommerce-invalid woocommerce-invalid-email');
            validated = false;
          }
        }
      }

      if (validated && $this.attr('id') !== 'flexi_mobile_number') {
        $parent
          .removeClass('woocommerce-invalid woocommerce-invalid-required-field')
          .addClass('woocommerce-validated');
      }
    },
    update_checkout: function(event, args) {
      // Small timeout to prevent multiple requests when several fields update at the same time
      wc_checkout_form.reset_update_checkout_timer();
      wc_checkout_form.updateTimer = setTimeout(
        wc_checkout_form.update_checkout_action,
        '5',
        args
      );
    },
    update_checkout_action: function(args) {
      if (wc_checkout_form.xhr) {
        wc_checkout_form.xhr.abort();
      }
      setTimeout($.unblockUI, 0);
      if ($('input.shipping_method:checked').val() != 'local_pickup_plus') {
        $('.checkout-results .col-2')
          .removeClass('hide')
          .addClass('show');
      } else {
        $('.checkout-results .col-2')
          .removeClass('show')
          .addClass('hide');
      }

      if ($('form.checkout').length === 0) {
        return;
      }

      args =
        typeof args !== 'undefined'
          ? args
          : {
              update_shipping_method: true,
            };
      sharafValidation.interMobileNumber();
      var country = $('#billing_country').val(),
        state = $('#billing_state').val(),
        postcode = $('input#billing_postcode').val(),
        city = $('#billing_city').val(),
        address = $('input#billing_address_1').val(),
        address_2 = $('input#billing_address_2').val(),
        s_shipping_phone = $('#shipping_phone').val(),
        s_mobile = $('#shipping_phone').val(),
        s_country = country,
        s_state = state,
        s_postcode = postcode,
        s_city = city,
        s_address = address,
        s_address_2 = address_2;

        
        if(s_shipping_phone){
          s_mobile = $('#shipping_phone').intlTelInput('getNumber');
        }

      if (
        $('#ship-to-different-address')
          .find('input')
          .is(':checked')
      ) {
        s_shipping_phone = $('#shipping_phone').val();
        if(s_shipping_phone){
          s_mobile = $('#shipping_phone').intlTelInput('getNumber');
        }
        s_country = $('#shipping_country').val();
        s_state = $('#shipping_state').val();
        s_postcode = $('input#shipping_postcode').val();
        s_city = $('#shipping_city').val();
        s_address = $('input#shipping_address_1').val();
        s_address_2 = $('input#shipping_address_2').val();
      }

      if (
        country == 'EG' &&
        typeof s_state !== 'undefined' &&
        s_state.length == 0
      ) {
        state = 'C';
        s_state = 'C';
        $('#shipping_state').val('C');
      }

      var data = {
        security: wc_checkout_params.update_order_review_nonce,
        payment_method: wc_checkout_form.get_payment_method(),
        country: country,
        state: state,
        postcode: postcode,
        city: city,
        address: address,
        address_2: address_2,
        s_country: s_country,
        s_state: s_state,
        s_postcode: s_postcode,
        s_city: s_city,
        s_mobile: s_mobile,
        s_address: s_address,
        s_address_2: s_address_2,
        post_data: $('form.checkout').serialize(),
        reload_payment: $('ul.wc_payment_methods ').length
      };

      if (false !== args.update_shipping_method) {
        var shipping_methods = {};

        $(
          'select.shipping_method, input[name^="shipping_method"][type="radio"]:checked, input[name^="shipping_method"][type="hidden"]'
        ).each(function() {
          shipping_methods[$(this).data('index')] = $(this).val();
        });

        data.shipping_method = shipping_methods;
      }

      /* $( '.woocommerce-checkout-payment, .woocommerce-checkout-review-order-table' ).block({
				message: null,
				overlayCSS: {
					background: '#fff',
					opacity: 0.6
				}
			});*/
      $(".payment_box .coupon_applied").html('')
      wc_checkout_form.xhr = $.ajax({
        type: 'POST',
        url: wc_checkout_params.wc_ajax_url
          .toString()
          .replace('%%endpoint%%', 'update_order_review'),
        data: data,
        success: function(data) {
          $('.cart-discount').removeClass('processing');
          // Reload the page if requested
          if ('true' === data.reload) {
            window.location.reload();
            return;
          }

          // Remove any notices added previously
          $('.woocommerce-NoticeGroup-updateOrderReview').remove();

          var termsCheckBoxChecked = $('#terms').prop('checked');
          $('.checkout-wrp').removeClass('hide');
          $('.checkout-loader').remove();
          // Always update the fragments
          if (data && data.fragments) {
            
            $.each(data.fragments, function(key, value) {
              // console.log($( key ).html());
//              if (key !== '.woocommerce-checkout-payment') {
                            if (key == "remove_cod") {
                                if (value == true) {
                                    $(".wc_payment_method.payment_method_cod").hide();
                                    $(".payment_box.payment_method_cod").hide();
                                    $("#payment_method_cod").prop('checked', false);
                                    $('#input[name=payment_method]:first').prop('checked', true);
                                    if($('input[name=payment_method]:checked').val() === undefined){
                                        $('input[name=payment_method]:first').trigger('click');
                                    }
                                } else {
                                    $(".wc_payment_method.payment_method_cod").show();

                                }

                            }
                            
                if(key == 'has_gc'){
                  
                 if (value == true) {
                    $('li.payment_method_sdg_points_pay').hide();
                  $('.payment_box.payment_method_sdg_points_pay').hide();
                  $('#payment_method_sdg_points_pay').prop('checked', false);
                  $('li.payment_method_sdg_payit').hide();
                  $('li.payment_method_ppec_paypal').hide();
                  $("#payment_method_sdg_payit").prop('checked', false);
                  $('#payment_method_ppec_paypal').prop('checked', false);
                    if($('input[name=payment_method]:checked').val() === undefined){
                        $('#input[name=payment_method]:first').prop('checked', true);
                        $('input[name=payment_method]:first').trigger('click');
                    }
                 }  else{
                     
                if ($('.wc_payment_method.payment_method_sdg_payit').length > 0) {
                    $('.wc_payment_method.payment_method_sdg_payit').show();
                }

                if ($('.wc_payment_method.payment_method_sdg_points_pay').length > 0) {
                    $('.wc_payment_method.payment_method_sdg_points_pay').show();
                }
                
                if ($('.wc_payment_method.payment_method_ppec_paypal').length > 0) {
                    $('.wc_payment_method.payment_method_ppec_paypal').show();
                }
                
                }
              }


                            if (key == 'payment_methods' && $(".payment_method_cod").length == 0) {
                                $(".woocommerce-checkout-payment")
                                        .replaceWith(value);
                            }
                $(key)
                  .replaceWith(value)
                  .promise()
                  .then(function() {
                    if (key == '.order-summary') {
                      $(".order-summary").on("click",".shipping-collapse", function(){
                        $(".shipping-collapse").toggleClass('active');
                        $(".shipping-charges").slideToggle();
                      });
                      wc_checkout_coupons.init();
                      if ($(value).find('.coupon-discount').length != 0) {
                        if(THEMEVERSION == 2){
                          $(".payment_box .coupon_applied").append('<p>' + $.validator.messages.coupon_applied + '</p>')
                        } else {
                          Materialize.toast(
                            $.validator.messages.coupon_applied,
                            '3500'
                          );
                        }
                      }
                      if ($(value).find('.gift-card-total').length != 0) {
                        if(THEMEVERSION == 2){
                          $(".payment_box .coupon_applied").append('<p>' + $.validator.messages.gift_card_applied + '</p>')
                        } else {
                          Materialize.toast(
                            $.validator.messages.gift_card_applied,
                            '3500',
                            'toast-yellow'
                          );
                        }
                        
                        $('.gift-card-redeem').slideUp(400, function () {
                        $('.gift-card-redeem')
                            .find(':input:eq(0)')
                            .focus();
                        });
                        
                        $("#payment_method_gift_card").data('waschecked', false);
                        $("#payment_method_gift_card").prop('checked', false);
                        
                      }
                    }

                    if (key == '.woocommerce-checkout-payment') {
                     
                      wc_checkout_form.saved_card_changed()
                      if($('input[name="card_to_use"]:checked').val() && $('input[name="card_to_use"]:checked').val() != 'new_card'){
                        $(".payment_method_sdg_checkout .row.card-fields").hide()
                    }
                      
                    }

                    if (
                      $('input.shipping_method:checked').val() ==
                      'local_pickup_plus'
                    ) {
                      // $('select.pickup_location').selectric();
                      // $( '#shipping_country').prop("disabled",true).selectric('refresh');
                      $('#shipping_state').prop('disabled', true);
                      $('#shipping_first_name').prop('disabled', true);
                      $('#shipping_last_name').prop('disabled', true);
                      $('#shipping_address_1').prop('disabled', true);
                      $('#shipping_city').prop('disabled', true);
                      // alert($("#billing_country:first").val())
                    } else {
                      // $( '#shipping_country').prop("disabled",false).selectric('refresh');
                      $('#shipping_state').prop('disabled', false);
                      $('#shipping_first_name').prop('disabled', false);
                      $('#shipping_last_name').prop('disabled', false);
                      $('#shipping_address_1').prop('disabled', false);
                      $('#shipping_city').prop('disabled', false);
                    }
                    mobileSharafHome.animateFixedButton();
                    // $( key ).unblock();
                  });
//              }
            });
          }
          if ($('.order-total').length != 0) {
            $('.proceed-checkout strong').html($('.order-total strong').html());
          }
          if ($('.pickup_location').length != 0) {
            $('.checkout-results .col-2')
              .removeClass('show')
              .addClass('hide');
          }

          mobileSharafHome.animateFixedButton();

          if (typeof wc_city_select_params !== 'undefined') {
            stateSharafDG.bindAll();
          }
          // Recheck the terms and conditions box, if needed
          if (termsCheckBoxChecked) {
            $('#terms').prop('checked', true);
          }

          // Check for error
          if ('failure' === data.result) {
            var $form = $('form.checkout');

            // Remove notices from all sources
            $('.error-wrp').remove();
            $('.woocommerce-error, .woocommerce-message').remove();

            // Add new errors returned by this event
            if (data.messages) {
              $form.prepend(
                '<div class="woocommerce-NoticeGroup-updateOrderReview">' +
                  data.messages +
                  '</div>'
              );
            } else {
              $form.prepend(data);
            }

            // Lose focus for all fields
            $form.find('.input-text, select, input:checkbox').blur();

            // Scroll to top
            if(!window.checkout_scrolled){
            $('html, body').animate(
              {
                scrollTop: $('form.checkout').offset().top - 100,
              },
              1000
            );
            window.checkout_scrolled = true
            }
          }
          
          var selectedPaymentMethod = $(
            '.woocommerce-checkout input[name="payment_method"]:checked'
          ).attr('id');
          
          // Re-init methods
          wc_checkout_form.init_payment_methods(selectedPaymentMethod);
          if ($('input.shipping_method:checked').val() == 'local_pickup_plus') {
            $('select.pickup_location').select2();
          }

          // Fire updated_checkout e
          $(document.body).trigger('updated_checkout', [data]);
        },
      });
    },
    ship_form_validation: function($form) {
      $form.addClass('processing');
      var error_messages = ''
      var mobile_error = false
      if (
        //$('input.shipping_method:checked').length > 0  && 
      $('input.shipping_method:checked').val() != 'local_pickup_plus') {
        if ($('#shipping_phone').val() === '') {
          $('.shipping_phone')
            .find('.form-row')
            .removeClass('woocommerce-validated')
            .addClass('woocommerce-invalid woocommerce-invalid-required-field');
            error_messages += '<li class="shipping-error">' + $(".description", $('.shipping_phone').find('.form-row')).text() + '</li>'
            mobile_error = true
        }
        if (
          !$('#shipping_phone').intlTelInput('isValidNumber') &&
          $('#shipping_phone').intlTelInput('getNumberType') !== 1
        ) {
          $('#shipping_phone')
            .closest('.form-row')
            .removeClass('woocommerce-validated')
            .addClass('woocommerce-invalid woocommerce-invalid-required-field');
            if(!mobile_error){
              error_messages += '<li class="shipping-error">' + $(".description",  $('#shipping_phone').closest('.form-row')).text() + '</li>'
              mobile_error = true
            } 
        }
        
        if(!check_phone_valid()){
          $('#shipping_phone')
          .closest('.form-row')
          .removeClass('woocommerce-validated')
          .addClass('woocommerce-invalid woocommerce-invalid-required-field');
          if(!mobile_error){
            error_messages += '<li class="shipping-error">' + $(".description",  $('#shipping_phone').closest('.form-row')).text() + '</li>'
          }
        }

        if ($('#shipping_state').val() === '') {
          $('.shipping_state')
            .find('.form-row')
            .removeClass('woocommerce-validated')
            .addClass('woocommerce-invalid woocommerce-invalid-required-field');
            error_messages += '<li class="shipping-error">' + $(".description",   $('.shipping_state').find('.form-row')).text() + '</li>'
        }

        if ($('#shipping_city').val() === '' || $('#shipping_city').val() === null) {
          $('.shipping_city')
            .find('.form-row')
            .removeClass('woocommerce-validated')
            .addClass('woocommerce-invalid woocommerce-invalid-required-field');
            error_messages += '<li class="shipping-error">' + $(".description",   $('.shipping_city').find('.form-row')).text() + '</li>'
        }

        if (
          $('.shipping_address_1')
            .find('.input-text ')
            .val() === ''
        ) {
          $('.shipping_address_1')
            .find('.form-row')
            .removeClass('woocommerce-validated')
            .addClass('woocommerce-invalid woocommerce-invalid-required-field');
            error_messages += '<li class="shipping-error">' + $(".description",   $('.shipping_address_1').find('.form-row')).text() + '</li>'
        }

        if (
          $('.shipping_first_name')
            .find('.input-text')
            .val() === ''
        ) {
          $('.shipping_first_name')
            .find('.form-row')
            .removeClass('woocommerce-validated')
            .addClass('woocommerce-invalid woocommerce-invalid-required-field');
            error_messages += '<li class="shipping-error">' + $(".description",   $('.shipping_first_name').find('.form-row')).text() + '</li>'
        }

        if (
          $('.shipping_last_name')
            .find('.input-text')
            .val() === ''
        ) {
          $('.shipping_last_name')
            .find('.form-row')
            .removeClass('woocommerce-validated')
            .addClass('woocommerce-invalid woocommerce-invalid-required-field');
            error_messages += '<li class="shipping-error">' + $(".description",   $('.shipping_last_name').find('.form-row')).text() + '</li>'
        }
        if ($('.woocommerce-invalid-required-field').length != 0) {
          if(!window.checkout_scrolled){
          $('html, body').animate(
            {
              scrollTop:
                $('.woocommerce-invalid-required-field')
                  .eq(0)
                  .offset().top - $('#header').height(),
            },
            400, function() {
              
            });    
            window.checkout_scrolled = true 
          }

          if($('.error-wrp').length == 0){
            $('.card-form').prepend('<div class="error-wrp"><ul class="woocommerce-error">'+error_messages+'</ul></div>');
        } else{
          $('.woocommerce-error').prepend(error_messages);
        }

        $form.removeClass('processing');  
        return false;
        }
      } else {
        if ($('select.pickup_location').val() === '') {
          $('.woocommerce-checkout-review-order-table .select2-container')
            .removeClass('woocommerce-validated')
            .addClass('woocommerce-invalid woocommerce-invalid-required-field');
          if ($('.pickup-error').length === 0) {
            $('.woocommerce-checkout-review-order-table .select2-container').append(
              '<span class="pickup-error error"><span class="description">'+$.validator.messages.pickupStore+'</span></span>'
            );
          }
          if(!window.checkout_scrolled){
          $('html, body').animate(
            {
              scrollTop:
                $('.pickup_location')
                  .offset().top - $('#header').height(),
            },
            400, function() {
              
            });
            window.checkout_scrolled = true
          }
          $form.removeClass('processing');
          return false;
        } else {
          $('.woocommerce-checkout-review-order-table .select2-container')
          .removeClass('woocommerce-invalid woocommerce-invalid-required-field');
          $('.woocommerce-checkout-review-order-table .error').remove();
        }
      }
      
      $form.removeClass('processing');
      return true;
    },
    submit: function() {
      var $form = $(this);
      $('.error-wrp').remove();
      $(".woocommerce > .woocommerce-error").remove()
      var isVaildated = wc_checkout_form.ship_form_validation($form);
      window.checkout_scrolled = false

      $.blockUI({
        message:
          ' <div class="sdg-perloader" style="width:62px;position:absolute;top:50%;"><span style="width:40px;height:40px;display:inline-block;position:relative;text-align:initial;border-color:#ffa619;border-width:3px;border-top-color:transparent;margin-right: 0;" class="sdg-spinner"></span>'+$.validator.messages.please_wait+'</div>',
        css: {padding: '20px', border: 0},
        overlayCSS: {background: '#fff', opacity: 0.6},
      });
      if (!isVaildated) {
        // setTimeout($.unblockUI, 2000);
        // return false;
      }

      wc_checkout_form.reset_update_checkout_timer();
   

      if ($form.is('.processing')) {
        return false;
      }

      // Trigger a handler to let gateways manipulate the checkout if needed
      if (
        $form.triggerHandler('checkout_place_order') !== false &&
        $form.triggerHandler(
          'checkout_place_order_' + wc_checkout_form.get_payment_method()
        ) !== false
      ) {
        $form.addClass('processing');

        if ($('#payment_method_sdg_checkout').length != 0) {
          if (
            $('#payment_method_sdg_checkout:checked').val() == 'sdg_checkout' &&
            $('#sdg-cko-card-token').val() === ''
          ) {
            // if ($('.woocommerce-invalid').length == 0) {
            // console.log('invalid');
            if(!$('input[name="card_to_use"]:checked').val() || $('input[name="card_to_use"]:checked').val() == 'new_card'){
            create_card_token();
            return false;
          } else {
            $input = $('input[name="card_to_use"]:checked')
            $card_cvv = $(".card_cvv_input",$input.closest('.saved_card'))
            if( $card_cvv.val() == ''){
               $card_cvv.parents('.form-row').addClass('has-error');
            }
            if(!isCVCValid($card_cvv.val())){
              var topScroll =  $('.card-form').offset().top - 100;
              if($('.checkout-overlay').length != 0){
                  $('.checkout-overlay').removeClass('active');
                  topScroll = 0; 
              }
              $('.card-form').removeClass('processing');
              var errorMsg = '<li>'+ $.validator.messages.enter_card_details+'</li>';
              if($('.error-wrp').length == 0){
                  $('.card-form').prepend('<div class="error-wrp card-error"><ul class="woocommerce-error">'+errorMsg+'</ul></div>');
              } else{
                if($('.card-error').length == 0){
                      $('.woocommerce-error').prepend(errorMsg);
                  } else {
                      $('.card-error').remove();
                      $('.card-form').prepend('<div class="error-wrp card-error"><ul class="woocommerce-error">'+errorMsg+'</ul></div>');          
                  }
              }
              $('html, body').animate(
                  {
                  scrollTop:  $('.card_to_use:checked').offset().top,
                  },
                  1000
              );
              
              setTimeout($.unblockUI, 1000);
              return false
            } else {
              $input = $('input[name="card_to_use"]:checked')
              $card_cvv = $(".card_cvv_input",$input.closest('.saved_card'))
              $("#cko-card-cvv").val($card_cvv.val())
            }
          }
            // }
          }
        }


        if ($('#payment_method_sdg_payit').length != 0) {
          if (
            $('#payment_method_sdg_payit:checked').val() == 'sdg_payit'
          ) {
            if (
              !$('#payit_mobile_number').intlTelInput('isValidNumber') &&
              $('#payit_mobile_number').intlTelInput('getNumberType') !== 1
            ) {
              $('#payit_mobile_number')
                .closest('.form-row')
                .removeClass('woocommerce-validated')
                .addClass('woocommerce-invalid woocommerce-invalid-required-field');
                  error_messages = '<li class="payit-error">' + $(".description",  $('#payit_mobile_number').closest('.form-row')).text() + '</li>'
                  if($('.error-wrp').length == 0){
                    $('.card-form').prepend('<div class="error-wrp"><ul class="woocommerce-error">'+error_messages+'</ul></div>');
                } else{
                    $('.woocommerce-error').prepend(error_messages);
                }
            }
          }
        }
        
                
        if ($('#payment_method_cybersource').length != 0) {
          if($('#payment_method_cybersource:checked').val() == 'cybersource'){
              if(!isValidCBCreditCardData()){
                  $('.card-form').removeClass('processing');
                  return false;
              }
          }  
        }
        
    
        var form_data = $form.data();

        /* if ( 1 !== form_data['blockUI.isBlocked'] ) {
					$form.block({
						message: null,
						overlayCSS: {
							background: '#fff',
							opacity: 0.6
						}
					});
        }*/

        // ajaxSetup is global, but we use it to ensure JSON is valid once returned.
        $.ajaxSetup({
          dataFilter: function(raw_response, dataType) {
            // We only want to work with JSON
            if ('json' !== dataType) {
              return raw_response;
            }

            try {
              // Check for valid JSON
              var data = $.parseJSON(raw_response);

              if (data && 'object' === typeof data) {
                // Valid - return it so it can be parsed by Ajax handler
                return raw_response;
              }
            } catch (e) {
              // Attempt to fix the malformed JSON
              var valid_json = raw_response.match(/{"result.*"}/);

              if (null === valid_json) {
                console.log('Unable to fix malformed JSON');
              } else {
                console.log('Fixed malformed JSON. Original:');
                console.log(raw_response);
                raw_response = valid_json[0];
              }
            }

            return raw_response;
          },
        });
        var callAjax = true;
        if (
          $('.woocommerce-invalid').length !== 0 &&
          $('.home-delivery:visible').length !== 0
        ) {
          callAjax = false;
        }
        if (callAjax) {
          var formdata = $form.serializeArray();
          formdata.forEach(function(item) {
            if (item.name === 'shipping_phone' || item.name === 'flexi_mobile_number') {
              item.value = $('#'+item.name).intlTelInput('getNumber');
              if(item.name !== 'flexi_mobile_number' && $('input.shipping_method:checked').val() == 'local_pickup_plus'){
                item.value = '';
              }
            } else if (item.name === 'payit_mobile_number') {
              item.value = $('#'+item.name).intlTelInput('getNumber');
              if(item.value){
                item.value= item.value.replace('+','');
              }
            }

            if (typeof FS != "undefined" && typeof FS.log != "undefined") {
                if (item.name === 'shipping_first_name' || item.name === 'shipping_last_name' ||
                item.name === 'shipping_phone' || item.name === 'shipping_address_1' ||
                item.name === 'shipping_country' || item.name === 'shipping_state' ||
                item.name === 'shipping_city'
                ) {
                  FS.log(item.name+': '+item.value);
                }
            }
          });
         
          $.ajax({
            type: 'POST',
            url: wc_checkout_params.checkout_url,
            data: $.param(formdata),
            dataType: 'json',
            success: function(result) {
              $.unblockUI();
              try {
                if (result.result === 'success') {
                    
                    if (result.paymentMethod == 'cybersource') {
                    
                    $("#cb_payment_confirmation").html(result.cb_form_elements).submit();
                    
                    return false;
                  }

                  if(result.paymentMethod == 'applepay'){
                    if (result.sendJSON) {
                      handleSendJSON(result.jsonData);
                      return false;
                    }

                    if(result.closeApplePayCard){
                      setTimeout($.unblockUI, 500);
                      return false;
                    }

                    if(result.paymentSuccessApplePayCard){
                      onPaymentSuccessApplePayCard();                      
                    }
                    
                    if(result.paymentFailureApplePayCard){
                      onPaymentFailureApplePayCard();                      
                    }                                                                               
                  }
                  
                  if(result.paymentMethod == "payit" && result.handleInvalidOTP){
                    handle_payit_invalid_otp_error('mobile');
                    return false;
                  }                                    
                  if(result.paymentMethod == "payit" && result.handleOTP){
                    var resendOTP = result.resendOTP || false; 
                    handle_otp(resendOTP,'mobile');
                    return false;
                  }
                  if(result.paymentMethod == "payit" && result.handleInsufficientBalance){
                    handle_payit_insufficient_balance_error('mobile');
                    $("#popup_payit_otp").val('');
                    $('.payit__error').removeClass('hide').html( 
                    result.messages 
                    );
                    setTimeout($.unblockUI, 2000);
                    return false;
                  }
                  if(result.paymentMethod == "payit" && result.handleOTPGenericError){
                    handle_payit_generic_error('mobile');
                    $("#popup_payit_otp").val('');
                    $('.payit__error').removeClass('hide').html( 
                    result.messages 
                    );
                    setTimeout($.unblockUI, 2000);
                    return false;                    
                  }

                  if (
                    -1 === result.redirect.indexOf('https://') ||
                    -1 === result.redirect.indexOf('http://')
                  ) {
                    window.location = result.redirect;
                  } else {
                    window.location = decodeURI(result.redirect);
                  }
                } else if (result.result === 'failure') {
                    onPaymentFailureApplePayCard();
                    throw 'Result failure';
                } else {
                    onPaymentFailureApplePayCard();
                    throw 'Invalid response';
                }
              } catch (err) {
                // Reload page
                if (result.reload === 'true') {
                  window.location.reload();
                  return;
                }

                // Trigger update in case we need a fresh nonce
                if (result.refresh === 'true') {
                  $(document.body).trigger('update_checkout');
                }

                // Add new errors
                if (result.messages) {
                  $('.error-wrp').remove();
                  wc_checkout_form.submit_error(result.messages);
                } else {
                  wc_checkout_form.submit_error(
                    '<div class="woocommerce-error">' +
                      wc_checkout_params.i18n_checkout_error +
                      '</div>'
                  );
                }
              }
            },
            error: function(jqXHR, textStatus, errorThrown) {
              wc_checkout_form.submit_error(
                '<div class="woocommerce-error">' + errorThrown + '</div>'
              );
            },
          });
        } else {
          if(!window.checkout_scrolled){
          $('html, body').animate(
            {
              scrollTop: $('form.checkout').offset().top - 100
            },
            1000
          );
          window.checkout_scrolled = true
          }
          setTimeout(function() {
            $form.removeClass('processing');
          }, 500);
          setTimeout($.unblockUI, 2000);
        }
      }

      return false;
    },
    submit_error: function(error_message) {
      $('.woocommerce-error, .woocommerce-message').remove();
      wc_checkout_form.$checkout_form.prepend(error_message);
      wc_checkout_form.$checkout_form.removeClass('processing');
      setTimeout($.unblockUI, 2000);
      wc_checkout_form.$checkout_form
        .find('.input-text, select, input:checkbox')
        .blur();
        if(!window.checkout_scrolled){
      $('html, body').animate(
        {
          scrollTop: $('form.checkout').offset().top - 100,
        },
        1000
      );
      window.checkout_scrolled = true
        }
      $(document.body).trigger('checkout_error');
    },
  };

  var wc_checkout_coupons = {
    init: function() {
      $('.order-summary').on('click', 'a.showcoupon', this.show_coupon_form);
      $('.order-summary').on(
        'click',
        '.woocommerce-remove-coupon',
        this.remove_coupon
      );
      $('form.checkout_coupon')
        .submit(this.submit);
    },
    show_coupon_form: function() {
      $('.checkout_coupon').slideToggle(400, function() {
        $('.checkout_coupon')
          .find(':input:eq(0)')
          .focus();
      });
      return false;
    },
    submit: function() {
      var $form = $(this);

      if ($form.is('.processing')) {
        return false;
      }

      $form.addClass('processing');

      var data = {
        security: wc_checkout_params.apply_coupon_nonce,
        coupon_code: $form.find('input[name="coupon_code"]').val(),
      };

      $.ajax({
        type: 'POST',
        url: wc_checkout_params.wc_ajax_url
          .toString()
          .replace('%%endpoint%%', 'apply_coupon'),
        data: data,
        success: function(code) {
          $('.woocommerce-error, .woocommerce-message').remove();
          $form.removeClass('processing');

          if (code) {
            $('.order-summary').before(code);
            //$form.slideUp();

            $(document.body).trigger('update_checkout', {
              update_shipping_method: false,
            });
          }
        },
        dataType: 'html',
      });

      return false;
    },
    remove_coupon: function(e) {
      e.preventDefault();

      var container = $(this).parents('.woocommerce-checkout-review-order'),
        coupon = $(this).data('coupon');

      container.addClass('processing');
      $('.cart-discount').addClass('processing');
      var data = {
        security: wc_checkout_params.remove_coupon_nonce,
        coupon: coupon
      };

      $.ajax({
        type: 'POST',
        url: wc_checkout_params.wc_ajax_url.toString().replace('%%endpoint%%', 'remove_coupon'),
        data: data,
        success: function(code) {
          $('.woocommerce-error, .woocommerce-message').remove();
          container.removeClass('processing');
         
          if (code) {
            $('.checkout_coupon').after(code);

            $(document.body).trigger('update_checkout', {
              update_shipping_method: false,
            });

            // Remove coupon code from coupon field
            $('form.checkout_coupon')
              .find('input[name="coupon_code"]')
              .val('');
          }
          //$('.cart-discount').removeClass('processing');
        },
        error: function(jqXHR) {
          if (wc_checkout_params.debug_mode) {
            /* jshint devel: true */
            console.log(jqXHR.responseText);
          }
          $('.cart-discount').removeClass('processing');
        },
        dataType: 'html',
      });
    }
  };

  var wc_checkout_login_form = {
    init: function() {
      $(document.body).on('click', 'a.showlogin', this.show_login_form);
    },
    show_login_form: function() {
      $('form.login').slideToggle();
      return false;
    },
  };

  wc_checkout_form.init();
  // wc_checkout_coupons.init();
  wc_checkout_login_form.init();
});

window.addEventListener("beforeunload", function(event) {
  $.unblockUI();
});

window.onpageshow = function (event) {
  $.unblockUI();

};

window.addEventListener('unload', function() {
  $.unblockUI();

});
