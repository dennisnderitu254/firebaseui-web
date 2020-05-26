/*
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Tests for common handler utilities.
 */
goog.provide('firebaseui.auth.widget.handler.CommonTest');
goog.setTestOnly('firebaseui.auth.widget.handler.CommonTest');

goog.require('firebaseui.auth.Account');
goog.require('firebaseui.auth.AuthUI');
goog.require('firebaseui.auth.AuthUIError');
goog.require('firebaseui.auth.PendingEmailCredential');
goog.require('firebaseui.auth.RedirectStatus');
goog.require('firebaseui.auth.idp');
goog.require('firebaseui.auth.log');
goog.require('firebaseui.auth.soy2.strings');
goog.require('firebaseui.auth.storage');
goog.require('firebaseui.auth.ui.page.Callback');
goog.require('firebaseui.auth.ui.page.ProviderSignIn');
goog.require('firebaseui.auth.widget.Config');
goog.require('firebaseui.auth.widget.handler');
goog.require('firebaseui.auth.widget.handler.common');
/** @suppress {extraRequire} */
goog.require('firebaseui.auth.widget.handler.handleEmailLinkSignInSent');
goog.require('firebaseui.auth.widget.handler.handleFederatedLinking');
/** @suppress {extraRequire} Required for accountchooser.com page navigation to
 *      work. */
goog.require('firebaseui.auth.widget.handler.handleFederatedSignIn');
goog.require('firebaseui.auth.widget.handler.handlePasswordLinking');
goog.require('firebaseui.auth.widget.handler.handlePasswordSignIn');
goog.require('firebaseui.auth.widget.handler.handlePasswordSignUp');
goog.require('firebaseui.auth.widget.handler.handleProviderSignIn');
/** @suppress {extraRequire} */
goog.require('firebaseui.auth.widget.handler.handleSendEmailLinkForSignIn');
goog.require('firebaseui.auth.widget.handler.handleSignIn');
goog.require('firebaseui.auth.widget.handler.testHelper');
goog.require('goog.Promise');
goog.require('goog.dom.forms');
goog.require('goog.testing.AsyncTestCase');
goog.require('goog.testing.recordFunction');


var asyncTestCase = goog.testing.AsyncTestCase.createAndInstall();


var federatedAccount = new firebaseui.auth.Account('user@example.com',
    'Federated User');
var federatedAccountWithProvider = new firebaseui.auth.Account(
    'user@example.com', 'Federated User', null, 'google.com');


// TODO: Update all the tests when accountchooser.com handlers change.
function testSelectFromAccountChooser_noResponse() {
  firebaseui.auth.storage.rememberAccount(passwordAccount, app.getAppId());
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  testAc.assertTrySelectAccount([passwordAccount]);
  assertFalse(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
}


function testSelectFromAccountChooser_noResponse_tenantId() {
  // Test that tenant ID is stored before redirecting to accountchooser.com.
  app.setTenantId('TENANT_ID');
  firebaseui.auth.storage.rememberAccount(passwordAccount, app.getAppId());
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  testAc.assertTrySelectAccount([passwordAccount]);
  assertFalse(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertEquals(
      'TENANT_ID',
      firebaseui.auth.storage.getRedirectStatus(app.getAppId()).getTenantId());
}


function testSelectFromAccountChooser_noResponse_uiShown() {
  app.setConfig({
    'callbacks': {
      'uiShown': uiShownCallback
    }
  });
  testAc.setSkipSelect(true);
  var redirectStatus = new firebaseui.auth.RedirectStatus();
  firebaseui.auth.storage.setRedirectStatus(redirectStatus, app.getAppId());
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  firebaseui.auth.storage.rememberAccount(passwordAccount, app.getAppId());
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  assertUiShownCallbackInvoked();
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  testAc.assertTrySelectAccount([passwordAccount]);
  assertFalse(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
}


function testSelectFromAccountChooser_registeredFederatedAccount() {
  // Test when selected account is a registered federated account in
  // provider-first mode.
  // Test with signInOptions containing additional scopes.
  app.updateConfig('signInOptions', signInOptionsWithScopes);
  asyncTestCase.waitForSignals(1);
  testAc.setSelectedAccount(federatedAccount);
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  testAuth.assertFetchSignInMethodsForEmail(
      [federatedAccount.getEmail()],
      ['google.com']);
  testAuth.process().then(function() {
    assertFederatedLinkingPage(federatedAccount.getEmail());
    assertTrue(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
    assertFalse(firebaseui.auth.storage.isRememberAccount(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSelectFromAccountChooser_registeredFedAcct_uiShown() {
  // Test when selected account is a registered federated account.
  // Ui shown callback is still called.
  app.setConfig({
    'signInOptions': signInOptionsWithScopes,
    'callbacks': {
      'uiShown': uiShownCallback
    }
  });
  asyncTestCase.waitForSignals(1);
  testAc.setSelectedAccount(federatedAccount);
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  testAuth.assertFetchSignInMethodsForEmail(
      [federatedAccount.getEmail()],
      ['google.com']);
  testAuth.process().then(function() {
    assertUiShownCallbackInvoked();
    assertFederatedLinkingPage(federatedAccount.getEmail());
    assertTrue(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
    assertFalse(firebaseui.auth.storage.isRememberAccount(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSelectFromAccountChooser_registeredPasswordAccount() {
  // Test when selected account is a registered password account in
  // provider-first mode.
  // Test with signInOptions containing additional scopes.
  app.updateConfig('signInOptions', signInOptionsWithScopes);
  asyncTestCase.waitForSignals(1);
  testAc.setSelectedAccount(passwordAccount);
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  testAuth.assertFetchSignInMethodsForEmail(
      [passwordAccount.getEmail()],
      ['password']);
  testAuth.process().then(function() {
    assertPasswordSignInPage();
    assertEquals(
        passwordAccount.getEmail(), goog.dom.forms.getValue(getEmailElement()));
    assertEquals(0, getIdpButtons().length);
    assertTrue(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
    assertFalse(firebaseui.auth.storage.isRememberAccount(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSelectFromAccountChooser_registeredEmailLinkAccount() {
  // Test when selected account is a registered email link account in
  // provider-first mode.
  app.updateConfig('signInOptions', emailLinkSignInOptions);
  var expectedActionCodeSettings = buildActionCodeSettings();
  asyncTestCase.waitForSignals(1);
  testAc.setSelectedAccount(passwordAccount);
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  testAuth.assertFetchSignInMethodsForEmail(
      [passwordAccount.getEmail()],
      ['emailLink']);
  return testAuth.process().then(function() {
    // Callback page should be rendered.
    assertCallbackPage();
    testAuth.assertSendSignInLinkToEmail(
        [passwordAccount.getEmail(), expectedActionCodeSettings]);
    assertTrue(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
    assertFalse(firebaseui.auth.storage.isRememberAccount(app.getAppId()));
    return testAuth.process();
  }).then(function () {
    assertEmailLinkSignInSentPage();
    // Email for email link sign in should be stored.
    assertEquals(
        passwordAccount.getEmail(),
        firebaseui.auth.storage.getEmailForSignIn('SESSIONID', app.getAppId()));
    mockClock.tick(3600000);
    assertFalse(firebaseui.auth.storage.hasEmailForSignIn(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSelectFromAccountChooser_registeredEmailLinkAccount_error() {
  // Test when selected account is a registered email link account in
  // provider-first mode. If error is thrown while sending the email, goes back
  // to the sign in page and show error message.
  app.updateConfig('signInOptions', emailLinkSignInOptions);
  var expectedActionCodeSettings = buildActionCodeSettings();
  asyncTestCase.waitForSignals(1);
  testAc.setSelectedAccount(passwordAccount);
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  testAuth.assertFetchSignInMethodsForEmail(
      [passwordAccount.getEmail()],
      ['emailLink']);
  testAuth.process().then(function() {
    // Callback page should be rendered.
    assertCallbackPage();
    testAuth.assertSendSignInLinkToEmail(
        [passwordAccount.getEmail(), expectedActionCodeSettings], null,
        internalError);
    assertTrue(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
    assertFalse(firebaseui.auth.storage.isRememberAccount(app.getAppId()));
    return testAuth.process();
  }).then(function() {
    // Verify that error message is displayed on the sign in page.
    assertSignInPage();
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    assertFalse(firebaseui.auth.storage.hasEmailForSignIn(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSelectFromAccountChooser_unregisteredAccount() {
  // Test when selected account is an unregistered federated account in
  // provider-first mode.
  // Test with signInOptions containing additional scopes.
  app.updateConfig('signInOptions', signInOptionsWithScopes);
  asyncTestCase.waitForSignals(1);
  testAc.setSelectedAccount(federatedAccount);
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  testAuth.assertFetchSignInMethodsForEmail(
      [federatedAccount.getEmail()],
      []);
  testAuth.process().then(function() {
    // Unregistered federated account should be treated as password sign up in
    // provider-first display mode.
    assertPasswordSignUpPage();
    assertEquals(
        federatedAccount.getEmail(),
        goog.dom.forms.getValue(getEmailElement()));
    assertEquals(
        federatedAccount.getDisplayName(),
        goog.dom.forms.getValue(getNameElement()));
    asyncTestCase.signal();
  });
}


function testSelectFromAccountChooser_error() {
  // Test when error occurs in fetchSignInMethodsForEmail.
  asyncTestCase.waitForSignals(1);
  testAc.setSelectedAccount(federatedAccount);
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  testAuth.assertFetchSignInMethodsForEmail(
      [federatedAccount.getEmail()], null, internalError);
  testAuth.process().then(function() {
    // Unregistered federated account should be treated as password sign up in
    // provider-first display mode.
    assertProviderSignInPage();
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testSelectFromAccountChooser_registeredPassAcct_uiShown() {
  // Test when select account is a registered password account with ui shown
  // callback.
  app.setConfig({
    'callbacks': {
      'uiShown': uiShownCallback
    }
  });
  asyncTestCase.waitForSignals(1);
  testAc.setSelectedAccount(passwordAccount);
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  testAuth.assertFetchSignInMethodsForEmail(
      [passwordAccount.getEmail()],
      ['password']);
  testAuth.process().then(function() {
    assertUiShownCallbackInvoked();
    assertPasswordSignInPage();
    assertEquals(
        passwordAccount.getEmail(), goog.dom.forms.getValue(getEmailElement()));
    assertEquals(0, getIdpButtons().length);
    assertTrue(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
    assertFalse(firebaseui.auth.storage.isRememberAccount(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSelectFromAccountChooser_addAccount() {
  testAc.setAddAccount();
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  // The sign-in page should show.
  assertSignInPage();
  assertTosPpFooter(tosCallback, 'http://localhost/privacy_policy');
  assertFalse(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
}


function testSelectFromAccountChooser_addAccount_passwordOnly() {
  app.setConfig({
    'signInOptions': [
        firebase.auth.EmailAuthProvider.PROVIDER_ID
      ]
  });
  testAc.setAddAccount();
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  // The sign-in page should show.
  assertSignInPage();
  assertTosPpFullMessage(tosCallback, 'http://localhost/privacy_policy');
  assertFalse(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
}


function testSelectFromAccountChooser_addAccount_uiShown() {
  // Test add account option from accountchooser.com with ui shown callback.
  app.setConfig({
    'callbacks': {
      'uiShown': uiShownCallback
    }
  });
  testAc.setAddAccount();
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  assertUiShownCallbackInvoked();
  assertSignInPage();
  assertFalse(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
}


function testSetLoggedInWithAuthResult_incompatibilityError() {
  // Test when an incompatible version of Firebase.js is used with latest
  // version of firebaseui. In that case a user is passed instead of an
  // UserCredential object. This results in an undefined user being
  // passed to setLoggedInWithAuthResult.
  testStubs.set(
      firebaseui.auth.log,
      'error',
      goog.testing.recordFunction());
  app.setConfig({
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true)
    }
  });
  var cred = firebase.auth.EmailAuthProvider.credential(
      passwordUser['email'], 'password');
  testAuth.setUser(passwordUser);
  // AuthResult will have an undefined user.
  var internalAuthResult = {
    'user': undefined,
    'credential': cred,
    'operationType': undefined,
    'additionalUserInfo': undefined
  };
  asyncTestCase.waitForSignals(1);
  return firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult)
      .then(function() {
        // The above will throw an error which should be logged to the console.
        assertEquals(1, firebaseui.auth.log.error.getCallCount());
        assertEquals(
            firebaseui.auth.AuthUI.INCOMPATIBLE_DEPENDENCY_ERROR,
            firebaseui.auth.log.error.getLastCall().getArgument(0));
        var actualError =
            firebaseui.auth.log.error.getLastCall().getArgument(1);
        assertEquals(
            firebaseui.auth.AuthUI.INCOMPATIBLE_DEPENDENCY_ERROR,
            actualError.message);
        // Error should be displayed in the info bar.
        assertInfoBarMessage(
            firebaseui.auth.AuthUI.INCOMPATIBLE_DEPENDENCY_ERROR,
            testComponent);
        asyncTestCase.signal();
      });
}

function testSetLoggedInWithAuthResult() {
  testStubs.set(
      firebaseui.auth.log,
      'warning',
      goog.testing.recordFunction());
  app.setConfig({
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true),
      'signInSuccess': signInSuccessCallback(true)
    }
  });
  assertEquals(1, firebaseui.auth.log.warning.getCallCount());
  var deprecateWarning = 'signInSuccess callback is deprecated. Please use ' +
      'signInSuccessWithAuthResult callback instead.';
  assertEquals(deprecateWarning,
        firebaseui.auth.log.warning.getLastCall().getArgument(0));
  asyncTestCase.waitForSignals(1);
  var cred = firebase.auth.EmailAuthProvider.credential(
      passwordUser['email'], 'password');
  testAuth.setUser(passwordUser);
  var internalAuthResult = {
    'user': passwordUser,
    'credential': cred,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'password', 'isNewUser': true}
  };
  // Confirm revertLanguageCode called on setLoggedInWithAuthResult.
  assertNoRevertLanguageCode();
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  assertRevertLanguageCode(app);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      // Credential should not be returned in callback for password provider.
      'credential': null,
      'operationType': 'signIn',
      // isNewUser should be associated with the internal Auth instance.
      'additionalUserInfo':  {'providerId': 'password', 'isNewUser': true}
    };
    // Both old and new signInSuccess callbacks are provided.
    // Warning will be logged.
    /** @suppress {missingRequire} */
    assertEquals(2, firebaseui.auth.log.warning.getCallCount());
    var callbackWarning = 'Both signInSuccess and ' +
        'signInSuccessWithAuthResult callbacks are provided. Only ' +
        'signInSuccessWithAuthResult callback will be invoked.';
    /** @suppress {missingRequire} */
    assertEquals(callbackWarning,
        firebaseui.auth.log.warning.getLastCall().getArgument(0));
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        undefined);
    testUtil.assertGoTo('http://localhost/home');
    assertEquals(1, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    assertObjectEquals(
        passwordAccount, firebaseui.auth.storage.getRememberedAccounts(
            app.getAppId())[0]);
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_federatedLinking() {
  app.setConfig({
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true)
    }
  });
  asyncTestCase.waitForSignals(1);
  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'link',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': false}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      'credential': federatedCredential,
      // Opeartion type for linking flow should still be signIn.
      'operationType': 'signIn',
      // isNewUser should be false for linking flow.
      'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': false}
    };
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        undefined);
    testUtil.assertGoTo('http://localhost/home');
    assertEquals(1, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    assertObjectEquals(
        federatedAccountWithProvider,
        firebaseui.auth.storage.getRememberedAccounts(app.getAppId())[0]);
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_noRedirect() {
  app.setConfig({
    'callbacks': {
      // Provide a callback returns false, will not redirect after signing in.
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(false)
    }
  });
  asyncTestCase.waitForSignals(1);
  var cred = firebase.auth.EmailAuthProvider.credential(
      passwordUser['email'], 'password');
  testAuth.setUser(passwordUser);
  var internalAuthResult = {
    'user': passwordUser,
    'credential': cred,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'password', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    testAuth.assertSignOut([]);
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      'credential': null,
      'operationType': 'signIn',
      // isNewUser should be associate with the internal Auth instance.
      'additionalUserInfo':  {'providerId': 'password', 'isNewUser': true}
    };
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        undefined);
    assertEquals(1, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    assertObjectEquals(
        passwordAccount, firebaseui.auth.storage.getRememberedAccounts(
            app.getAppId())[0]);
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_notRememberAccount() {
  app.setConfig({
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true)
    }
  });
  // Sets the config not to remember accounts.
  firebaseui.auth.storage.setRememberAccount(false, app.getAppId());
  asyncTestCase.waitForSignals(1);
  var cred = firebase.auth.EmailAuthProvider.credential(
      passwordUser['email'], 'password');
  testAuth.setUser(passwordUser);
  var internalAuthResult = {
    'user': passwordUser,
    'credential': cred,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'password', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      // Credential should not be returned in callback for password provider.
      'credential': null,
      'operationType': 'signIn',
      // isNewUser should be associate with the internal Auth instance.
      'additionalUserInfo':  {'providerId': 'password', 'isNewUser': true}
    };
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        undefined);
    testUtil.assertGoTo('http://localhost/home');
    assertEquals(0, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_storageAutoRedirect() {
  asyncTestCase.waitForSignals(1);
  var redirectUrl = 'http://www.example.com';
  // Set redirect URL in storage.
  firebaseui.auth.storage.setRedirectUrl(redirectUrl, app.getAppId());
  app.setConfig({
    // No need for a signInSuccessUrl here and it should not raise an error.
    'signInSuccessUrl': undefined,
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true)
    }
  });
  firebaseui.auth.storage.setRememberAccount(false, app.getAppId());
  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      'credential': federatedCredential,
      'operationType': 'signIn',
      // isNewUser should be associate with the internal Auth instance.
      'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
    };
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        redirectUrl);
    // Continue to redirect URL specified in storage.
    testUtil.assertGoTo(redirectUrl);
    assertEquals(0, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    // Confirm redirect URL is cleared from storage.
    assertFalse(firebaseui.auth.storage.hasRedirectUrl(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_storageNoRedirect() {
  asyncTestCase.waitForSignals(1);
  var redirectUrl = 'http://www.example.com';
  // Set redirect URL in storage.
  firebaseui.auth.storage.setRedirectUrl(redirectUrl, app.getAppId());
  app.setConfig({
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(false)
    }
  });
  firebaseui.auth.storage.setRememberAccount(false, app.getAppId());
  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    testAuth.assertSignOut([]);
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      'credential': federatedCredential,
      'operationType': 'signIn',
      // isNewUser should be associate with the internal Auth instance.
      'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
    };
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        redirectUrl);
    testUtil.assertGoTo(null);
    assertEquals(0, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    // Confirm redirect URL is cleared from storage.
    assertFalse(firebaseui.auth.storage.hasRedirectUrl(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_onlySignInSuccessCallback() {
  app.setConfig({
    'callbacks': {
      'signInSuccess': signInSuccessCallback(false)
    }
  });
  asyncTestCase.waitForSignals(1);
  var cred = firebase.auth.EmailAuthProvider.credential(
      passwordUser['email'], 'password');
  testAuth.setUser(passwordUser);
  var internalAuthResult = {
    'user': passwordUser,
    'credential': cred,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'password', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    testAuth.assertSignOut([]);
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    // SignInSuccessCallback is called.
    assertSignInSuccessCallbackInvoked(
        externalAuth.currentUser,
        null,
        undefined);
    assertEquals(1, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    assertObjectEquals(
        passwordAccount, firebaseui.auth.storage.getRememberedAccounts(
            app.getAppId())[0]);
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_alreadySignedIn() {
  // Test when user already signed in on external Auth instance.
  asyncTestCase.waitForSignals(1);
  app.setConfig({
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true)
    }
  });
  externalAuth.setUser(federatedUser);
  var externalAuthResult = {
    'user': externalAuth.currentUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': false}
  };
  return firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, externalAuthResult, true).then(function() {
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      'credential': federatedCredential,
      'operationType': 'signIn',
      'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': false}
    };
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        undefined);
    testUtil.assertGoTo('http://localhost/home');
    assertEquals(0, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_redirectNoRedirectUrl() {
  asyncTestCase.waitForSignals(1);
  app.setConfig({
    'signInSuccessUrl': undefined,
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true)
    }
  });
  firebaseui.auth.storage.setRememberAccount(false, app.getAppId());
  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    assertEquals(0, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    // Confirm redirect URL is cleared from storage.
    assertFalse(firebaseui.auth.storage.hasRedirectUrl(app.getAppId()));
    // No redirect occurred.
    testUtil.assertGoTo(null);
    // Error should be displayed in the info bar.
    assertInfoBarMessage(
        'No redirect URL has been found. You must either specify a signInSuc' +
        'cessUrl in the configuration, pass in a redirect URL to the widget ' +
        'URL, or return false from the callback.',
        testComponent);
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_updateCurrentUserError() {
  // Test when setLoggedInWithAuthResult is triggered and updateCurrentUser
  // fails with some error.
  asyncTestCase.waitForSignals(1);
  var expectedError = {
    'code': 'auth/internal-error',
    'message': 'Internal error'
  };
  app.setConfig({
    'signInSuccessUrl': undefined,
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true)
    }
  });
  firebaseui.auth.storage.setRememberAccount(false, app.getAppId());
  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
  };
  // Render the UI.
  var component = new firebaseui.auth.ui.page.Callback();
  component.render(container);
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, component, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        null,
        expectedError);
    return externalAuth.process();
  }).then(function() {
    assertEquals(0, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    // Confirm redirect URL is cleared from storage.
    assertFalse(firebaseui.auth.storage.hasRedirectUrl(app.getAppId()));
    // No redirect occurred.
    testUtil.assertGoTo(null);
    // Same page rendered.
    assertCallbackPage();
    // Error should be displayed in the info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(expectedError));
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_storageManualRedirect() {
  asyncTestCase.waitForSignals(1);
  // Set redirect URL in storage.
  var redirectUrl = 'http://www.example.com';
  firebaseui.auth.storage.setRedirectUrl(redirectUrl, app.getAppId());
  // Test sign in success callback with a manual redirect.
  app.setConfig({
    // No need for a signInSuccessUrl here and it should not raise an error.
    'signInSuccessUrl': undefined,
    'callbacks': {
      'signInSuccessWithAuthResult':
          signInSuccessWithAuthResultCallback(false, true)
    }
  });
  firebaseui.auth.storage.setRememberAccount(false, app.getAppId());
  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    testAuth.assertSignOut([]);
    // SignInSuccessWithAuthResultCallback is called.
    // redirectUrl passed to callback, developer has to manually redirect.
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      'credential': federatedCredential,
      'operationType': 'signIn',
      // isNewUser should be associate with the internal Auth instance.
      'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
    };
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        redirectUrl);
    // Developer manually continues to redirect URL specified in storage.
    testUtil.assertGoTo(redirectUrl);
    assertEquals(0, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    // Confirm redirect URL is cleared from storage.
    assertFalse(firebaseui.auth.storage.hasRedirectUrl(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_popup() {
  testUtil.setHasOpener(true);
  app.setConfig({
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true)
    }
  });
  asyncTestCase.waitForSignals(1);
  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      'credential': federatedCredential,
      'operationType': 'signIn',
      // isNewUser should be associate with the internal Auth instance.
      'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
    };
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        undefined);
    testUtil.assertOpenerGoTo('http://localhost/home');
    assertEquals(1, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    assertObjectEquals(
        federatedAccountWithProvider,
        firebaseui.auth.storage.getRememberedAccounts(app.getAppId())[0]);
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_popup_noRedirect() {
  testUtil.setHasOpener(true);
  app.setConfig({
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(false)
    }
  });
  asyncTestCase.waitForSignals(1);
  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    testAuth.assertSignOut([]);
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      'credential': federatedCredential,
      'operationType': 'signIn',
      // isNewUser should be associate with the internal Auth instance.
      'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
    };
    // Callback supplied. Window should only be closed by developer.
    testUtil.assertWindowNotClosed(window);
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        undefined);
    assertEquals(1, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    assertObjectEquals(
        federatedAccountWithProvider,
        firebaseui.auth.storage.getRememberedAccounts(app.getAppId())[0]);
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_popup_storageAutoRedirect() {
  testUtil.setHasOpener(true);
  asyncTestCase.waitForSignals(1);
  var redirectUrl = 'http://www.example.com';
  // Set redirect URL in storage.
  firebaseui.auth.storage.setRedirectUrl(redirectUrl, app.getAppId());
  app.setConfig({
    // No need for a signInSuccessUrl here and it should not raise an error.
    'signInSuccessUrl': undefined,
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true)
    }
  });
  firebaseui.auth.storage.setRememberAccount(false, app.getAppId());

  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      'credential': federatedCredential,
      'operationType': 'signIn',
      // isNewUser should be associate with the internal Auth instance.
      'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
    };
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        redirectUrl);
    // Continue to redirect URL specified in storage.
    testUtil.assertOpenerGoTo(redirectUrl);
    assertEquals(0, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    // Confirm redirect URL is cleared from storage.
    assertFalse(firebaseui.auth.storage.hasRedirectUrl(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_popup_storageNoRedirect() {
  testUtil.setHasOpener(true);
  asyncTestCase.waitForSignals(1);
  var redirectUrl = 'http://www.example.com';
  // Set redirect URL in storage.
  firebaseui.auth.storage.setRedirectUrl(redirectUrl, app.getAppId());
  app.setConfig({
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(false)
    }
  });
  firebaseui.auth.storage.setRememberAccount(false, app.getAppId());
  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    testAuth.assertSignOut([]);
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      'credential': federatedCredential,
      'operationType': 'signIn',
      // isNewUser should be associate with the internal Auth instance.
      'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
    };
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        redirectUrl);
    // No redirect.
    testUtil.assertOpenerGoTo(null);
    // Callback supplied. Window should only be closed by developer.
    testUtil.assertWindowNotClosed(window);
    assertEquals(0, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    // Confirm redirect URL is cleared from storage.
    assertFalse(firebaseui.auth.storage.hasRedirectUrl(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_popup_storageManualRedirect() {
  testUtil.setHasOpener(true);
  asyncTestCase.waitForSignals(1);
  // Set redirect URL in storage.
  var redirectUrl = 'http://www.example.com';
  firebaseui.auth.storage.setRedirectUrl(redirectUrl, app.getAppId());
  // Test sign in success callback with a manual redirect.
  app.setConfig({
    // No need for a signInSuccessUrl here and it should not raise an error.
    'signInSuccessUrl': undefined,
    'callbacks': {
      'signInSuccessWithAuthResult':
          signInSuccessWithAuthResultCallback(false, true)
    }
  });
  firebaseui.auth.storage.setRememberAccount(false, app.getAppId());
  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    testAuth.assertSignOut([]);
    // SignInSuccessWithAuthResultCallback is called.
    // redirectUrl passed to callback, developer has to manually redirect.
    var expectedAuthResult = {
      // User returned should be the one signed in external Auth instance.
      'user': externalAuth.currentUser,
      'credential': federatedCredential,
      'operationType': 'signIn',
      // isNewUser should be associate with the internal Auth instance.
      'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
    };
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        redirectUrl);
    // Callback supplied. Window should only be closed by developer.
    testUtil.assertWindowNotClosed(window);
    // Developer manually continues to redirect URL specified in storage.
    testUtil.assertGoTo(redirectUrl);
    assertEquals(0, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    // Confirm redirect URL is cleared from storage.
    assertFalse(firebaseui.auth.storage.hasRedirectUrl(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_popup_redirectNoRedirectUrl() {
  asyncTestCase.waitForSignals(1);
  app.setConfig({
    'signInSuccessUrl': undefined,
    'callbacks': {
      'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true)
    }
  });
  testUtil.setHasOpener(true);
  firebaseui.auth.storage.setRememberAccount(false, app.getAppId());
  testAuth.setUser(federatedUser);
  var internalAuthResult = {
    'user': federatedUser,
    'credential': federatedCredential,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'google.com', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    assertEquals(0, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    // Confirm redirect URL is cleared from storage.
    assertFalse(firebaseui.auth.storage.hasRedirectUrl(app.getAppId()));
    // No redirect occurred.
    testUtil.assertGoTo(null);
    // Error should be displayed in the info bar.
    assertInfoBarMessage(
        'No redirect URL has been found. You must either specify a signInSuc' +
        'cessUrl in the configuration, pass in a redirect URL to the widget ' +
        'URL, or return false from the callback.',
        testComponent);
    asyncTestCase.signal();
  });
}


function testSetLoggedInWithAuthResult_popup_noCallback_storageRedirect() {
  // Clear callbacks from configuration, set signInSuccessUrl which will be
  // overridden.
  app.setConfig({
    'callbacks': null,
    'signInSuccessUrl': 'http://localhost/home'
  });
  asyncTestCase.waitForSignals(1);
  // Set redirect URL in storage.
  var redirectUrl = 'http://www.example.com';
  firebaseui.auth.storage.setRedirectUrl(redirectUrl, app.getAppId());
  testUtil.setHasOpener(true);
  var cred = firebase.auth.EmailAuthProvider.credential(
      passwordUser['email'], 'password');
  testAuth.setUser(passwordUser);
  var internalAuthResult = {
    'user': passwordUser,
    'credential': cred,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': 'password', 'isNewUser': true}
  };
  firebaseui.auth.widget.handler.common.setLoggedInWithAuthResult(
      app, testComponent, internalAuthResult);
  // Sign out from internal instance and then sign in with passed credential to
  // external instance.
  return testAuth.process().then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [internalAuthResult['user']],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    // Assert opener continues to redirect URL specified in storage.
    testUtil.assertOpenerGoTo(redirectUrl);
    testUtil.assertWindowClosed(window);
    assertEquals(1, firebaseui.auth.storage.getRememberedAccounts(
        app.getAppId()).length);
    assertObjectEquals(
        passwordAccount, firebaseui.auth.storage.getRememberedAccounts(
            app.getAppId())[0]);
    // Confirm redirect URL is cleared from storage.
    assertFalse(firebaseui.auth.storage.hasRedirectUrl(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testHandleUnrecoverableError() {
  // Test rendering of unrecoverable error handling.
  var errorMessage = 'Some unrecoverable error message';
  firebaseui.auth.widget.handler.common.handleUnrecoverableError(
      app, container, errorMessage);
  // Assert unrecoverable error message page with correct message.
  assertUnrecoverableErrorPage(errorMessage);
  // Reset current rendered widget page.
  app.getAuth().assertSignOut([]);
  app.reset();
  // Container should be cleared.
  assertComponentDisposed();
}


function testAccountChooserInvoked() {
  // accountchooser.com invoked callback.
  var onContinueRecorded = null;
  var accountChooserInvokedCalled = false;
  var accountChooserInvokedCallback = function(onContinue) {
    onContinueRecorded = onContinue;
    accountChooserInvokedCalled = true;
  };
  // On continue callback.
  var onContinueCalled = false;
  var onContinue = function() {
    onContinueCalled = true;
  };

  // No callback provided. On continue should be run.
  firebaseui.auth.widget.handler.common.accountChooserInvoked(app, onContinue);
  assertFalse(accountChooserInvokedCalled);
  assertNull(onContinueRecorded);
  assertTrue(onContinueCalled);

  // accountchooser.com invoked callback provided, callback should be called
  // with onContinue function passed.
  onContinueCalled = false;
  accountChooserInvokedCalled = false;
  onContinueRecorded = null;
  app.setConfig({
    'callbacks': {
      'accountChooserInvoked': accountChooserInvokedCallback
    }
  });
  firebaseui.auth.widget.handler.common.accountChooserInvoked(app, onContinue);
  assertTrue(accountChooserInvokedCalled);
  assertEquals(onContinue, onContinueRecorded);
  assertFalse(onContinueCalled);
}


function testAccountChooserResult() {
  var code = firebaseui.auth.widget.Config.AccountChooserResult;
  // accountchooser.com result callback.
  var onContinueRecorded = null;
  var typeRecorded = null;
  var accountChooserResultCalled = false;
  var accountChooserResultCallback = function(type, onContinue) {
    typeRecorded = type;
    onContinueRecorded = onContinue;
    accountChooserResultCalled = true;
  };
  // On continue callback.
  var onContinueCalled = false;
  var onContinue = function() {
    onContinueCalled = true;
  };

  // Only continue callback provided.
  // No accountchooser.com result called. However, on continue is called.
  firebaseui.auth.widget.handler.common.accountChooserResult(
      app, code.EMPTY, onContinue);
  assertFalse(accountChooserResultCalled);
  assertTrue(onContinueCalled);

  // Config callback provided along with continue callback.
  // accountchooser.com result called. On continue function passed but not run.
  app.setConfig({
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback
    }
  });
  onContinueRecorded = null;
  typeRecorded = null;
  accountChooserResultCalled = false;
  onContinueCalled = false;
  firebaseui.auth.widget.handler.common.accountChooserResult(
      app, code.EMPTY, onContinue);
  assertTrue(accountChooserResultCalled);
  assertEquals(onContinue, onContinueRecorded);
  assertEquals(code.EMPTY, typeRecorded);
  assertFalse(onContinueCalled);
}


function testSelectFromAccountChooser_acCallbacks_unavailable() {
  // Test email first mode select from accountchooser.com when
  // accountchooser.com callbacks provided.
  // Test when accountchooser.com is unavailable.
  app.setConfig({
    'credentialHelper': firebaseui.auth.widget.Config.CredentialHelper.NONE,
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback,
      'accountChooserInvoked': accountChooserInvokedCallback
    }
  });
  // Simulate accountchooser.com being unavailable.
  testAc.setSkipSelect(true);
  testAc.setAvailability(false);
  // Trigger select from accountchooser.com.
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  // Confirm accountchooser.com invoked callback called and run on continue
  // function.
  assertAndRunAccountChooserInvokedCallback();
  // accountchooser.com unavailable.
  assertAndRunAccountChooserResultCallback('unavailable');
  // The sign-in page should show.
  assertSignInPage();
}


function testSelectFromAccountChooser_acCallbacks_empty() {
  // Test email-first mode select from accountchooser.com when
  // accountchooser.com callbacks provided.
  // Test when accountchooser.com is empty.
  app.setConfig({
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback,
      'accountChooserInvoked': accountChooserInvokedCallback
    }
  });
  // Simulate empty response from accountchooser.com.
  testAc.setSkipSelect(true);
  // Trigger select from accountchooser.com.
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  // Confirm accountchooser.com invoked callback called and run on continue
  // function.
  assertAndRunAccountChooserInvokedCallback();
  // Empty accountchooser.com response.
  assertAndRunAccountChooserResultCallback('empty');
  // The sign-in page should show.
  assertSignInPage();
}


function testSelectFromAccountChooser_acCallbacks_unregistered() {
  // Test when an account is selected from accountchooser.com.
  app.setConfig({
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback,
      'accountChooserInvoked': accountChooserInvokedCallback
    }
  });
  asyncTestCase.waitForSignals(1);
  // Simulate account selected from accountchooser.com.
  testAc.setSelectedAccount(passwordAccount);
  // Trigger select from accountchooser.com.
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  // No pending accountchooser.com response which will trigger try select.
  testAc.forceOnEmpty();
  // Confirm accountchooser.com invoked callback called and run on continue
  // function.
  assertAndRunAccountChooserInvokedCallback();
  // Existing account selected logged.
  assertAndRunAccountChooserResultCallback('accountSelected');

  testAuth.assertFetchSignInMethodsForEmail(
      [passwordAccount.getEmail()],
      []);
  testAuth.process().then(function() {
    // Unregistered federated account should be treated as password sign up in
    // provider-first display mode.
    assertPasswordSignUpPage();
    assertEquals(
        passwordAccount.getEmail(),
        goog.dom.forms.getValue(getEmailElement()));
    assertEquals(
        passwordAccount.getDisplayName(),
        goog.dom.forms.getValue(getNameElement()));
    asyncTestCase.signal();
  });
}


function testSelectFromAccountChooser_acCallbacks_existingAcct() {
  // Test when an account is selected from accountchooser.com that is a password
  // user.
  app.setConfig({
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback,
      'accountChooserInvoked': accountChooserInvokedCallback
    }
  });
  asyncTestCase.waitForSignals(1);
  // Simulate account selected from accountchooser.com.
  testAc.setSelectedAccount(passwordAccount);
  // Trigger select from accountchooser.com.
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  // No pending accountchooser.com response which will trigger try select.
  testAc.forceOnEmpty();
  // Confirm accountchooser.com invoked callback called and run on continue
  // function.
  assertAndRunAccountChooserInvokedCallback();
  // Existing account selected logged.
  assertAndRunAccountChooserResultCallback('accountSelected');
  testAuth.assertFetchSignInMethodsForEmail(
      [passwordAccount.getEmail()],
      ['google.com', 'password']);
  testAuth.process().then(function() {
    assertPasswordSignInPage();
    assertEquals(
        passwordAccount.getEmail(), goog.dom.forms.getValue(getEmailElement()));
    assertEquals(0, getIdpButtons().length);
    assertTrue(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
    assertFalse(firebaseui.auth.storage.isRememberAccount(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSelectFromAccountChooser_acCallbacks_existingAccount_error() {
  // Test select from accountchooser.com when accountchooser.com callbacks
  // provided. Test when an account is selected from accountchooser.com and
  // error returned from FirebaseUI server.
  app.setConfig({
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback,
      'accountChooserInvoked': accountChooserInvokedCallback
    }
  });
  asyncTestCase.waitForSignals(1);
  // Simulate account selected from accountchooser.com.
  testAc.setSelectedAccount(federatedAccount);
  // Trigger select from accountchooser.com.
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  // No pending accountchooser.com response which will trigger try select.
  testAc.forceOnEmpty();
  // Confirm accountchooser.com invoked callback called and run on continue
  // function.
  assertAndRunAccountChooserInvokedCallback();
  // Existing account selected logged.
  assertAndRunAccountChooserResultCallback('accountSelected');
  testAuth.assertFetchSignInMethodsForEmail(
      [federatedAccount.getEmail()], null, internalError);
  testAuth.process().then(function() {
    // An error in fetch providers for email should redirect to provider sign in
    // page with the error message in the info bar.
    assertProviderSignInPage();
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testSelectFromAccountChooser_acCallbacks_addAccount() {
  // Test when add account is selected from accountchooser.com.
  app.setConfig({
    'callbacks': {
      'accountChooserResult': accountChooserResultCallback,
      'accountChooserInvoked': accountChooserInvokedCallback
    }
  });
  // Simulate add account in accountchooser.com click.
  testAc.setAddAccount();
  // Trigger select from accountchooser.com.
  firebaseui.auth.widget.handler.common.selectFromAccountChooser(getApp,
      container);
  // No pending accountchooser.com response which will trigger try select.
  testAc.forceOnEmpty();
  // Confirm accountchooser.com invoked callback called and run on continue
  // function.
  assertAndRunAccountChooserInvokedCallback();
  // Add account selected logged.
  assertAndRunAccountChooserResultCallback('addAccount');
  // The sign-in page should show.
  assertSignInPage();
}


function testHandleSignInFetchSignInMethodsForEmail_unregistered_password() {
  var signInMethods = [];
  var email = 'user@example.com';
  var displayName = 'John Doe';
  firebaseui.auth.widget.handler.common.handleSignInFetchSignInMethodsForEmail(
      app, container, signInMethods, email, displayName);
  // Password sign up page should show with email and display name populated.
  assertPasswordSignUpPage();
  assertTosPpFooter(tosCallback, 'http://localhost/privacy_policy');
  assertEquals(
        email,
        goog.dom.forms.getValue(getEmailElement()));
    assertEquals(
        displayName,
        goog.dom.forms.getValue(getNameElement()));
}


function testHandleSignInFetchSignInMethodsForEmail_unregistered_emailLink() {
  app.updateConfig('signInOptions', emailLinkSignInOptions);
  var expectedActionCodeSettings = buildActionCodeSettings();
  var signInMethods = [];
  var email = 'user@example.com';
  asyncTestCase.waitForSignals(1);
  firebaseui.auth.widget.handler.common.handleSignInFetchSignInMethodsForEmail(
      app, container, signInMethods, email);
  assertCallbackPage();
  testAuth.assertSendSignInLinkToEmail([email, expectedActionCodeSettings]);
  testAuth.process().then(function() {
    assertEmailLinkSignInSentPage();
    // Email for email link sign in should be stored.
    assertEquals(
        email,
        firebaseui.auth.storage.getEmailForSignIn('SESSIONID', app.getAppId()));
    mockClock.tick(3600000);
    assertFalse(firebaseui.auth.storage.hasEmailForSignIn(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testHandleSignInFetchSignInMethodsForEmail_unregistered_fullMsg() {
  var signInMethods = [];
  var email = 'user@example.com';
  var displayName = 'John Doe';
  firebaseui.auth.widget.handler.common.handleSignInFetchSignInMethodsForEmail(
      app, container, signInMethods, email, displayName, undefined, true);
  // Password sign up page should show with email and display name populated.
  assertPasswordSignUpPage();
  assertTosPpFullMessage(tosCallback, 'http://localhost/privacy_policy');
  assertEquals(
        email,
        goog.dom.forms.getValue(getEmailElement()));
    assertEquals(
        displayName,
        goog.dom.forms.getValue(getNameElement()));
}


function testHandleSignInFetchSignInMethodsForEmail_registeredPasswordAcct() {
  var signInMethods = ['google.com', 'facebook.com', 'password'];
  var email = 'user@example.com';
  firebaseui.auth.widget.handler.common.handleSignInFetchSignInMethodsForEmail(
      app, container, signInMethods, email);
  // Password sign-in page should show.
  assertPasswordSignInPage();
  assertTosPpFooter(tosCallback, 'http://localhost/privacy_policy');
  assertEquals(email, goog.dom.forms.getValue(getEmailElement()));
  assertEquals(0, getIdpButtons().length);
}


function testHandleSignInFetchSignInMethodsForEmail_registeredPwdAcctFullMsg() {
  var signInMethods = ['google.com', 'facebook.com', 'password'];
  var email = 'user@example.com';
  firebaseui.auth.widget.handler.common.handleSignInFetchSignInMethodsForEmail(
      app, container, signInMethods, email, undefined, undefined, true);
  // Password sign-in page should show.
  assertPasswordSignInPage();
  assertTosPpFullMessage(tosCallback, 'http://localhost/privacy_policy');
  assertEquals(email, goog.dom.forms.getValue(getEmailElement()));
  assertEquals(0, getIdpButtons().length);
}


function testHandleSignInFetchSignInMethodsForEmail_registeredEmailLinkAcct() {
  app.updateConfig('signInOptions', emailLinkSignInOptions);
  var signInMethods = ['emailLink'];
  var expectedActionCodeSettings = buildActionCodeSettings();
  var email = 'user@example.com';
  asyncTestCase.waitForSignals(1);
  firebaseui.auth.widget.handler.common.handleSignInFetchSignInMethodsForEmail(
      app, container, signInMethods, email);
  assertCallbackPage();
  testAuth.assertSendSignInLinkToEmail([email, expectedActionCodeSettings]);
  testAuth.process().then(function() {
    assertEmailLinkSignInSentPage();
    // Email for email link sign in should be stored.
    assertEquals(
        email,
        firebaseui.auth.storage.getEmailForSignIn('SESSIONID', app.getAppId()));
    mockClock.tick(3600000);
    assertFalse(firebaseui.auth.storage.hasEmailForSignIn(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testHandleSignInFetchSignInMethodsForEmail_emailLinkAcct_error() {
  // Test the case that error is thrown while sending email link.
  app.updateConfig('signInOptions', emailLinkSignInOptions);
  var signInMethods = ['emailLink'];
  var expectedActionCodeSettings = buildActionCodeSettings();
  var email = 'user@example.com';
  asyncTestCase.waitForSignals(1);
  firebaseui.auth.widget.handler.common.handleSignInFetchSignInMethodsForEmail(
      app, container, signInMethods, email);
  assertCallbackPage();
  testAuth.assertSendSignInLinkToEmail(
      [email, expectedActionCodeSettings], null, internalError);
  testAuth.process().then(function() {
    // Verify that error message is displayed on the sign in page.
    assertSignInPage();
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    assertFalse(firebaseui.auth.storage.hasEmailForSignIn(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testHandleSignInFetchSignInMethodsForEmail_registeredFederatedAcct() {
  // Even email link sign in is available, should be still using google.
  var signInMethods = ['emailLink', 'google.com', 'facebook.com'];
  var email = 'user@example.com';
  firebaseui.auth.widget.handler.common.handleSignInFetchSignInMethodsForEmail(
      app, container, signInMethods, email);
  // It should store pending email.
  var expectedEmailCredential = {
    'credential': null,
    'email': email
  };
  assertObjectEquals(
      expectedEmailCredential,
      firebaseui.auth.storage.getPendingEmailCredential(app.getAppId())
          .toPlainObject());
  // Federated Linking page should show.
  assertFederatedLinkingPage(email);
}


function testHandleSignInFetchSignInMethodsForEmail_disabledFederatedAcct() {
  // Even if the account is linked with a SAML provider, as long as it's not
  // enabled in config, the unsupported provider page will be displayed to the
  // user.
  var signInMethods = ['saml.disabledProvider'];
  var email = 'user@example.com';
  firebaseui.auth.widget.handler.common.handleSignInFetchSignInMethodsForEmail(
      app, container, signInMethods, email);
  // It should not store pending email.
  assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
  // Unsupported provider page should show.
  assertUnsupportedProviderPage(email);
}


function testHandleSignInWithEmail_acInitialized() {
  var onPreSkip = goog.testing.recordFunction(function() {
    assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  });
  testAc.setSkipSelect(true, onPreSkip);
  firebaseui.auth.widget.handler.common.handleSignInWithEmail(app, container);
  assertEquals(1, onPreSkip.getCallCount());
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertFalse(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
  // Accountchooser client is already initialized.
  firebaseui.auth.widget.handler.common.handleSignInWithEmail(app, container);
  testAc.assertTrySelectAccount(
      firebaseui.auth.storage.getRememberedAccounts(app.getAppId()),
      'http://localhost/firebaseui-widget?mode=select');
  assertEquals(2, onPreSkip.getCallCount());
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
}


function testHandleSignInWithEmail_acNotEnabled() {
  testStubs.replace(
      firebaseui.auth.storage,
      'setRedirectStatus',
      goog.testing.recordFunction());
  app.setConfig({
    'credentialHelper': firebaseui.auth.widget.Config.CredentialHelper.NONE
  });
  firebaseui.auth.widget.handler.common.acForceUiShown_ = true;
  firebaseui.auth.widget.handler.common.handleSignInWithEmail(app, container);
  assertSignInPage();
  /** @suppress {missingRequire} */
  assertEquals(0,
      firebaseui.auth.storage.setRedirectStatus.getCallCount());
  assertFalse(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
  assertFalse(firebaseui.auth.widget.handler.common.acForceUiShown_);
}


function testHandleSignInWithEmail_prefillEmail() {
  const prefilledEmail = 'user@example';
  testStubs.replace(
      firebaseui.auth.storage,
      'setRedirectStatus',
      goog.testing.recordFunction());
  app.setConfig({
    'credentialHelper': firebaseui.auth.widget.Config.CredentialHelper.NONE
  });
  firebaseui.auth.widget.handler.common.acForceUiShown_ = true;
  firebaseui.auth.widget.handler.common.handleSignInWithEmail(
      app, container, prefilledEmail);
  assertBlankPage();
  /** @suppress {missingRequire} */
  assertEquals(0,
      firebaseui.auth.storage.setRedirectStatus.getCallCount());
  assertFalse(firebaseui.auth.storage.hasRememberAccount(app.getAppId()));
  assertFalse(firebaseui.auth.widget.handler.common.acForceUiShown_);

  testAuth.assertFetchSignInMethodsForEmail(
      [prefilledEmail],
      []);
  return testAuth.process().then(() => {
    // Password sign-up page should be shown.
    assertPasswordSignUpPage();
    // The prefilled email should be populated in the email entry.
    assertEquals(prefilledEmail, getEmailElement().value);
    return testAuth.process();
  });
}


function testHandleSignInFetchSignInMethodsForEmail_unsupportedProvider() {
  // When user has previously signed in with email link but only email/password
  // auth is supported in the app's configuration.
  var signInMethods = ['emailLink'];
  var email = 'user@example.com';
  app.updateConfig('signInOptions',  [{'provider': 'password'}]);
  firebaseui.auth.widget.handler.common.handleSignInFetchSignInMethodsForEmail(
      app, container, signInMethods, email);
  // It should not store pending email.
  assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
  // Unsupported provider page should show.
  assertUnsupportedProviderPage(email);
}


function testLoadAccountchooserJs_externallyLoaded() {
  // Test accountchooser.com client loading when already loaded.
  // Reset loadAccountchooserJs stubs.
  testStubs.reset();
  // Externally loaded.
  accountchooser = {};
  firebaseui.auth.widget.handler.common.acLoader_ = null;
  asyncTestCase.waitForSignals(1);
  var callback = function() {
    asyncTestCase.signal();
  };
  firebaseui.auth.widget.handler.common.loadAccountchooserJs(app, callback);
}


function testLoadAccountchooserJs_notLoaded() {
  // Test accountchooser.com client loading when not loaded.
  // Reset loadAccountchooserJs stubs.
  testStubs.reset();
  // Replace jsloader.
  var jsLoaderInvoked = 0;
  testStubs.replace(
      goog.net.jsloader, 'safeLoad', function() {
        return goog.Promise.resolve().then(function() {
          // Should be invoked once.
          jsLoaderInvoked++;
          assertEquals(1, jsLoaderInvoked);
        });
      });
  // This will force an attempt to load the client.
  accountchooser = undefined;
  firebaseui.auth.widget.handler.common.acLoader_ = null;
  asyncTestCase.waitForSignals(2);
  var callback = function() {
    asyncTestCase.signal();
  };
  var callback2 = function() {
    asyncTestCase.signal();
  };
  firebaseui.auth.widget.handler.common.loadAccountchooserJs(app, callback);
  firebaseui.auth.widget.handler.common.loadAccountchooserJs(app, callback2);
}


function testLoadAccountchooserJs_notSupported() {
  // Test accountchooser.com client loaded when it is not supported.
  testStubs.reset();
  // Simulate accountchooser.com not supported.
  testStubs.replace(
      firebaseui.auth.sni,
      'isSupported',
      function() {
        return false;
      });
  accountchooser = undefined;
  firebaseui.auth.widget.handler.common.acLoader_ = null;
  asyncTestCase.waitForSignals(1);
  var callback = function() {
    // Callback should still run even though not supported.
    assertUndefined(accountchooser);
    asyncTestCase.signal();
  };
  firebaseui.auth.widget.handler.common.loadAccountchooserJs(app, callback);
}


function testGetErrorMessage_unknownError_message() {
  var error = {
    code: 'UNKNOWN',
    message: 'Your API Key is invalid.'
  };
  var message = firebaseui.auth.widget.handler.common.getErrorMessage(error);
  assertEquals('Your API Key is invalid.', message);
}


function testGetErrorMessage_unknownError_jsonMessage() {
  testStubs.replace(
      firebaseui.auth.log,
      'error',
      goog.testing.recordFunction());
  var backendMessage = {
   'error': {
    'errors': [
     {
      'domain': 'global',
      'reason': 'invalid',
      'message': ''
     }
    ],
    'code': 400,
    'message': ''
   }
  };
  var error = {
    code: 'UNKNOWN',
    message: JSON.stringify(backendMessage)
  };
  var message = firebaseui.auth.widget.handler.common.getErrorMessage(error);
  /** @suppress {missingRequire} */
  assertEquals(1, firebaseui.auth.log.error.getCallCount());
  /** @suppress {missingRequire} */
  assertEquals(
      'Internal error: ' + JSON.stringify(backendMessage),
      firebaseui.auth.log.error.getLastCall().getArgument(0));
  assertEquals(firebaseui.auth.soy2.strings.internalError().toString(),
      message);
}


function testIsPasswordProviderOnly_multipleMixedProviders() {
  // Set a password and federated providers in the FirebaseUI instance
  // configuration.
  app.updateConfig(
      'signInOptions',
      [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID
      ]);
  assertFalse(
      firebaseui.auth.widget.handler.common.isPasswordProviderOnly(app));
}


function testIsPasswordProviderOnly_singlePasswordProvider() {
  // Set a password only provider in the FirebaseUI instance configuration.
  app.updateConfig(
      'signInOptions',
      [firebase.auth.EmailAuthProvider.PROVIDER_ID]);
  assertTrue(
      firebaseui.auth.widget.handler.common.isPasswordProviderOnly(app));
}


function testIsPasswordProviderOnly_singleFederatedProvider() {
  // Set a federated only provider in the FirebaseUI instance configuration.
  app.updateConfig(
      'signInOptions',
      [firebase.auth.GoogleAuthProvider.PROVIDER_ID]);
  assertFalse(
      firebaseui.auth.widget.handler.common.isPasswordProviderOnly(app));
}


function testIsPhoneProviderOnly() {
  // True if single, phone provider given
  app.updateConfig(
      'signInOptions', [firebase.auth.PhoneAuthProvider.PROVIDER_ID]);
  assertTrue(firebaseui.auth.widget.handler.common.isPhoneProviderOnly(app));
}


function testIsPhoneProviderOnly_singleFederatedProvider() {
  // False if phone provider not given
  app.updateConfig(
      'signInOptions', [firebase.auth.GoogleAuthProvider.PROVIDER_ID]);
  assertFalse(firebaseui.auth.widget.handler.common.isPhoneProviderOnly(app));
}


function testIsPhoneProviderOnly_multipleProviders() {
  // False if multiple providers given
  app.updateConfig('signInOptions', [
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    firebase.auth.PhoneAuthProvider.PROVIDER_ID
  ]);
  assertFalse(firebaseui.auth.widget.handler.common.isPhoneProviderOnly(app));
}


function testFederatedSignIn_success_redirectMode() {
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a signInWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertProviderSignInPage();
  // Confirm signInWithRedirect called underneath.
  testAuth.assertSignInWithRedirect([expectedProvider]);
  testAuth.process();

}


function testFederatedSignIn_success_redirectMode_tenantId() {
  app.setTenantId('TENANT_ID');
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a signInWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertEquals(
      'TENANT_ID',
      firebaseui.auth.storage.getRedirectStatus(app.getAppId()).getTenantId());
  assertProviderSignInPage();
  // Confirm signInWithRedirect called underneath.
  testAuth.assertSignInWithRedirect([expectedProvider]);
  testAuth.process();
}


function testFederatedSignIn_success_redirectMode_tenantId() {
  app.setTenantId('TENANT_ID');
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a signInWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertEquals(
      'TENANT_ID',
      firebaseui.auth.storage.getRedirectStatus(app.getAppId()).getTenantId());
  assertProviderSignInPage();
  // Confirm signInWithRedirect called underneath.
  testAuth.assertSignInWithRedirect([expectedProvider]);
  testAuth.process();
}


function testFederatedSignIn_error_redirectMode() {
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a signInWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertProviderSignInPage();
  // Confirm signInWithRedirect called underneath.
  testAuth.assertSignInWithRedirect([expectedProvider], null, internalError);
  testAuth.process().then(function() {
    // Error in signInWithRedirect, cancel the pending redirect status.
    assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
    asyncTestCase.signal();
  });
}



function testFederatedSignIn_success_cordova() {
  simulateCordovaEnvironment();
  var cred  = createMockCredential({
    'providerId': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a signInWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertProviderSignInPage();
  // Confirm signInWithRedirect called underneath.
  testAuth.assertSignInWithRedirect([expectedProvider]);
  return testAuth.process().then(function() {
    assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
    testAuth.setUser({
      'email': federatedAccount.getEmail(),
      'displayName': federatedAccount.getDisplayName()
    });
    testAuth.assertGetRedirectResult(
        [],
        {
          'user': testAuth.currentUser,
          'credential': cred
        });
    return testAuth.process();
  }).then(function() {
    assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
    assertCallbackPage();
    return testAuth.process();
  }).then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [testAuth.currentUser],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
    asyncTestCase.signal();
  });

}


function testFederatedSignIn_federatedLinkingRequiredError_cordova() {
  simulateCordovaEnvironment();
  var expectedError = {
    'code': 'auth/account-exists-with-different-credential',
    'credential': federatedCredential,
    'email': federatedAccount.getEmail(),
    'message': 'MESSAGE'
  };
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), federatedCredential);
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a signInWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertProviderSignInPage();
  // Confirm signInWithRedirect called underneath.
  testAuth.assertSignInWithRedirect([expectedProvider]);
  return testAuth.process().then(function() {
    testAuth.assertGetRedirectResult(
        [],
        null,
        expectedError);
    return testAuth.process();
  }).then(function() {
    assertNoInfoBarMessage();
    assertCallbackPage();
    // Simulate existing email belongs to a Facebook account.
    testAuth.assertFetchSignInMethodsForEmail(
        [federatedAccount.getEmail()], ['facebook.com']);
    return testAuth.process();
  }).then(function() {
    assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
    assertFederatedLinkingPage();
    assertObjectEquals(
      pendingEmailCred,
      firebaseui.auth.storage.getPendingEmailCredential(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testFederatedSignIn_error_cordova() {
  simulateCordovaEnvironment();
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a signInWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertProviderSignInPage();
  // Confirm signInWithRedirect called underneath.
  testAuth.assertSignInWithRedirect([expectedProvider]);
  return testAuth.process().then(function() {
    testAuth.assertGetRedirectResult(
        [],
        null,
        internalError);
    return testAuth.process();
  }).then(function() {
    assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
    // Provider sign in page should remain displayed.
    assertProviderSignInPage();
    // Confirm error message shown in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testFederatedSignIn_anonymousUpgrade_success_redirectMode() {
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  app.updateConfig('autoUpgradeAnonymousUsers', true);
  externalAuth.setUser(anonymousUser);
  asyncTestCase.waitForSignals(1);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a linkWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertProviderSignInPage();
  externalAuth.runAuthChangeHandler();
  // Confirm linkWithRedirect called underneath.
  externalAuth.currentUser.assertLinkWithRedirect([expectedProvider]);
  externalAuth.process().then(function() {
    asyncTestCase.signal();
  });
}


function testFederatedSignIn_anonymousUpgrade_error_redirectMode() {
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  app.updateConfig('autoUpgradeAnonymousUsers', true);
  externalAuth.setUser(anonymousUser);
  asyncTestCase.waitForSignals(1);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a linkWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertProviderSignInPage();
  externalAuth.runAuthChangeHandler();
  // Confirm linkWithRedirect called underneath.
  externalAuth.currentUser.assertLinkWithRedirect(
      [expectedProvider], null, internalError);
  externalAuth.process().then(function() {
    // Error in linkWithRedirect, cancel the pending redirect status.
    assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
    asyncTestCase.signal();
  });
}

function testFederatedSignIn_anonymousUpgrade_success_cordova() {
  simulateCordovaEnvironment();
  app.updateConfig('autoUpgradeAnonymousUsers', true);
  externalAuth.setUser(anonymousUser);
  var cred  = createMockCredential({
    'providerId': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a linkInWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertProviderSignInPage();
  externalAuth.runAuthChangeHandler();
  // Confirm linkWithRedirect called underneath.
  externalAuth.currentUser.assertLinkWithRedirect([expectedProvider]);
  return externalAuth.process().then(function() {
    assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
    externalAuth.setUser({
      'email': federatedAccount.getEmail(),
      'displayName': federatedAccount.getDisplayName()
    });
    externalAuth.assertGetRedirectResult(
        [],
        {
          'user': externalAuth.currentUser,
          'credential': cred
        });
    return externalAuth.process();
  }).then(function() {
    assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
    assertCallbackPage();
  }).then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
    asyncTestCase.signal();
  });
}


function testFederatedSignIn_anonymousUpgrade_credInUse_error_cordova() {
  simulateCordovaEnvironment();
  app.updateConfig('autoUpgradeAnonymousUsers', true);
  externalAuth.setUser(anonymousUser);
  var cred  = createMockCredential({
    'providerId': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  var expectedError = {
    'code': 'auth/credential-already-in-use',
    'credential': cred,
    'email': federatedAccount.getEmail(),
    'message': 'MESSAGE'
  };
  // Expected FirebaseUI error.
  var expectedMergeError = new firebaseui.auth.AuthUIError(
      firebaseui.auth.AuthUIError.Error.MERGE_CONFLICT,
      null,
      cred);
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a linkInWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertProviderSignInPage();
  externalAuth.runAuthChangeHandler();
  // Confirm linkWithRedirect called underneath.
  externalAuth.currentUser.assertLinkWithRedirect([expectedProvider]);
  return externalAuth.process().then(function() {
    assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
    externalAuth.assertGetRedirectResult(
        [],
        null,
        expectedError);
    return externalAuth.process();
  }).then(function() {
    // Pending credential should be cleared from storage.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // signInFailure triggered with expected error.
    assertSignInFailure(expectedMergeError);
    asyncTestCase.signal();
  });
}


function testFederatedSignIn_anonymousUpgrade_emailInUse_error_cordova() {
  simulateCordovaEnvironment();
  app.updateConfig('autoUpgradeAnonymousUsers', true);
  externalAuth.setUser(anonymousUser);
  var cred  = createMockCredential({
    'providerId': 'google.com',
    'accessToken': 'ACCESS_TOKEN'
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(), cred);
  var expectedError = {
    'code': 'auth/email-already-in-use',
    'credential': cred,
    'email': federatedAccount.getEmail(),
    'message': 'MESSAGE'
  };
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  assertFalse(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  // This will trigger a linkInWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.federatedSignIn(
      app, component, 'google.com');
  assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
  assertProviderSignInPage();
  externalAuth.runAuthChangeHandler();
  // Confirm linkWithRedirect called underneath.
  externalAuth.currentUser.assertLinkWithRedirect([expectedProvider]);
  return externalAuth.process().then(function() {
    assertTrue(firebaseui.auth.storage.hasRedirectStatus(app.getAppId()));
    externalAuth.assertGetRedirectResult(
        [],
        null,
        expectedError);
    return externalAuth.process();
  }).then(function() {
    assertCallbackPage();
    testAuth.assertFetchSignInMethodsForEmail(
        [federatedAccount.getEmail()], ['facebook.com']);
    return testAuth.process();
  }).then(function() {
    // The pending credential should be saved here.
    assertObjectEquals(
        pendingEmailCred,
        firebaseui.auth.storage.getPendingEmailCredential(app.getAppId()));
    // Federated linking flow should be triggered.
    assertFederatedLinkingPage(federatedAccount.getEmail());
    asyncTestCase.signal();
  });
}


function testHandleSignInAnonymously_success() {
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  firebaseui.auth.widget.handler.common.handleSignInAnonymously(
      app, component);
  assertProviderSignInPage();
  externalAuth.assertSignInAnonymously(
      [],
      {
        'user': anonymousUser,
        'credential': null
      });
  externalAuth.process().then(function() {
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
    asyncTestCase.signal();
  });
}


function testHandleSignInAnonymously_signInSuccessCallback() {
  app.updateConfig('callbacks', {
    'signInSuccessWithAuthResult': signInSuccessWithAuthResultCallback(true)
  });
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  firebaseui.auth.widget.handler.common.handleSignInAnonymously(
      app, component);
  assertProviderSignInPage();
  var expectedAuthResult = {
    'user': anonymousUser,
    'credential': null,
    'operationType': 'signIn',
    'additionalUserInfo':  {'providerId': null, 'isNewUser': true}
  };
  externalAuth.assertSignInAnonymously(
      [],
      expectedAuthResult);
  externalAuth.process().then(function() {
    // SignInSuccessWithAuthResultCallback is called.
    assertSignInSuccessWithAuthResultCallbackInvoked(
        expectedAuthResult,
        undefined);
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
    asyncTestCase.signal();
  });
}


function testHandleSignInAnonymously_error() {
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  firebaseui.auth.widget.handler.common.handleSignInAnonymously(
      app, component);
  assertProviderSignInPage();
  externalAuth.assertSignInAnonymously(
      [],
      null,
      internalError);
  externalAuth.process().then(function() {
    assertProviderSignInPage();
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
    asyncTestCase.signal();
  });
}


function testHandleGoogleYoloCredential_handledSuccessfully_withScopes() {
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  expectedProvider.addScope('googl1');
  expectedProvider.addScope('googl2');
  expectedProvider.setCustomParameters({
    'prompt': 'select_account',
    'login_hint': federatedAccount.getEmail()
  });
  // Enable googleyolo with Google provider and additional scopes.
  app.setConfig({
    'signInSuccessUrl': 'http://localhost/home',
    'signInOptions': [{
      'provider': 'google.com',
      'scopes': ['googl1', 'googl2'],
      'customParameters': {'prompt': 'select_account'},
      'authMethod': 'https://accounts.google.com',
      'clientId': '1234567890.apps.googleusercontent.com'
    }, 'facebook.com', 'password', 'phone'],
    'credentialHelper':
        firebaseui.auth.widget.Config.CredentialHelper.GOOGLE_YOLO
  });
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  // This will trigger a signInWithRedirect using the expected provider.
  firebaseui.auth.widget.handler.common.handleGoogleYoloCredential(
      app, component, googleYoloIdTokenCredential)
      .then(function(status) {
        // Remains on same page until redirect completes.
        assertProviderSignInPage();
        assertTrue(status);
        asyncTestCase.signal();
      });
  // Confirm signInWithRedirect called underneath.
  testAuth.assertSignInWithRedirect([expectedProvider]);
  testAuth.process();
}


function testHandleGoogleYoloCredential_handledSuccessfully_withoutScopes() {
  // Enable googleyolo with Google provider and no additional scopes.
  app.setConfig({
    'signInSuccessUrl': 'http://localhost/home',
    'signInOptions': [{
      'provider': 'google.com',
      'authMethod': 'https://accounts.google.com',
      'clientId': '1234567890.apps.googleusercontent.com'
    }, 'facebook.com', 'password', 'phone'],
    'credentialHelper':
        firebaseui.auth.widget.Config.CredentialHelper.GOOGLE_YOLO
  });
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  // This will succeed while callback page will be rendered as the result
  // gets processed before the redirect to success URL occurs.
  firebaseui.auth.widget.handler.common.handleGoogleYoloCredential(
      app, component, googleYoloIdTokenCredential)
      .then(function(status) {
        // Renders callback page while results are processed.
        assertCallbackPage();
        assertTrue(status);
        asyncTestCase.signal();
      });
  var expectedCredential = firebase.auth.GoogleAuthProvider.credential(
      googleYoloIdTokenCredential.idToken);
  var cred  = createMockCredential({
    'providerId': 'google.com',
    'idToken': googleYoloIdTokenCredential.idToken
  });
  testAuth.setUser({
    'email': federatedAccount.getEmail(),
    'displayName': federatedAccount.getDisplayName()
  });
  // Confirm signInWithCredential called underneath with
  // successful response.
  testAuth.assertSignInWithCredential(
      [expectedCredential],
      {
        'user': testAuth.currentUser,
        'credential': cred
      });
  // Confirm successful flow completes.
  testAuth.process().then(function() {
    assertCallbackPage();
    return testAuth.process();
  }).then(function() {
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    externalAuth.assertUpdateCurrentUser(
        [testAuth.currentUser],
        function() {
          externalAuth.setUser(testAuth.currentUser);
        });
    return externalAuth.process();
  }).then(function() {
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
  });
}


function testHandleGoogleYoloCredential_unhandled_withoutScopes() {
  // Enable googleyolo with Google provider and no additional scopes.
  app.setConfig({
    'signInSuccessUrl': 'http://localhost/home',
    'signInOptions': [{
      'provider': 'google.com',
      'authMethod': 'https://accounts.google.com',
      'clientId': '1234567890.apps.googleusercontent.com'
    }, 'facebook.com', 'password', 'phone'],
    'credentialHelper':
        firebaseui.auth.widget.Config.CredentialHelper.GOOGLE_YOLO
  });
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  // This will fail and an error message will be shown.
  firebaseui.auth.widget.handler.common.handleGoogleYoloCredential(
      app, component, googleYoloIdTokenCredential)
      .then(function(status) {
        // Remains on the same page.
        assertProviderSignInPage();
        assertFalse(status);
        asyncTestCase.signal();
      });
  var expectedCredential = firebase.auth.GoogleAuthProvider.credential(
      googleYoloIdTokenCredential.idToken);
  // Confirm signInWithCredential called underneath with
  // unsuccessful response.
  testAuth.assertSignInWithCredential(
      [expectedCredential],
      null,
      internalError);
  testAuth.process().then(function() {
    // Remains on the same page.
    assertProviderSignInPage();
    // Confirm error message shown in info bar.
    assertInfoBarMessage(
        firebaseui.auth.widget.handler.common.getErrorMessage(internalError));
  });
}


function testHandleGoogleYoloCredential_cancelled_withoutScopes() {
  // Enable googleyolo with Google provider and no additional scopes.
  app.setConfig({
    'signInSuccessUrl': 'http://localhost/home',
    'signInOptions': [{
      'provider': 'google.com',
      'authMethod': 'https://accounts.google.com',
      'clientId': '1234567890.apps.googleusercontent.com'
    }, 'facebook.com', 'password', 'phone'],
    'credentialHelper':
        firebaseui.auth.widget.Config.CredentialHelper.GOOGLE_YOLO
  });
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  // This will fail due to the reset call which will interrupt the underlying
  // call.
  firebaseui.auth.widget.handler.common.handleGoogleYoloCredential(
      app, component, googleYoloIdTokenCredential)
      .then(function(status) {
        // Remains on the same page.
        assertProviderSignInPage();
        assertFalse(status);
        asyncTestCase.signal();
      });
  // Reset will cancel underlying pending promises.
  app.getAuth().assertSignOut([]);
  app.reset();
}


function testHandleGoogleYoloCredential_unsupportedCredential() {
  // Enable googleyolo with Google provider and no additional scopes.
  app.setConfig({
    'signInSuccessUrl': 'http://localhost/home',
    'signInOptions': [{
      'provider': 'google.com',
      'authMethod': 'https://accounts.google.com',
      'clientId': '1234567890.apps.googleusercontent.com'
    }, 'facebook.com', 'password', 'phone'],
    'credentialHelper':
        firebaseui.auth.widget.Config.CredentialHelper.GOOGLE_YOLO
  });
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  // Pass unsupported credential and confirm the expected error shown on the
  // page.
  firebaseui.auth.widget.handler.common.handleGoogleYoloCredential(
      app, component, googleYoloOtherCredential)
      .then(function(status) {
        // Remains on the same page.
        assertProviderSignInPage();
        assertInfoBarMessage(
            firebaseui.auth.soy2.strings.errorUnsupportedCredential()
            .toString());
        assertFalse(status);
        asyncTestCase.signal();
      });
}


function testHandleGoogleYoloCredential_upgradeAnonymous_noScopes() {
  // Enable googleyolo with Google provider and no additional scopes.
  app.setConfig({
    // Set anonymous user upgrade to true.
    'autoUpgradeAnonymousUsers': true,
    'signInSuccessUrl': 'http://localhost/home',
    'signInOptions': [{
      'provider': 'google.com',
      'authMethod': 'https://accounts.google.com',
      'clientId': '1234567890.apps.googleusercontent.com'
    }, 'facebook.com', 'password', 'phone'],
    'credentialHelper':
        firebaseui.auth.widget.Config.CredentialHelper.GOOGLE_YOLO
  });
  var expectedCredential = firebase.auth.GoogleAuthProvider.credential(
      googleYoloIdTokenCredential.idToken);
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  // Simulate anonymous user initially signed in on external instance.
  externalAuth.setUser(anonymousUser);
  // This will succeed while callback page will be rendered as the result
  // gets processed before the redirect to success URL occurs.
  firebaseui.auth.widget.handler.common.handleGoogleYoloCredential(
      app, component, googleYoloIdTokenCredential)
      .then(function(status) {
        // Renders callback page while results are processed.
        assertCallbackPage();
        assertTrue(status);
        asyncTestCase.signal();
      });
  // Trigger onAuthStateChanged listener.
  externalAuth.runAuthChangeHandler();
  // Confirm linkWithCredential called underneath with
  // successful response.
  externalAuth.currentUser.assertLinkWithCredential(
      [expectedCredential],
      function() {
        // User should be signed in.
        externalAuth.setUser({
          'email': federatedAccount.getEmail(),
          'displayName': federatedAccount.getDisplayName()
        });
        return {
          'user': externalAuth.currentUser,
          'credential': expectedCredential
        };
      });
  // Confirm successful flow completes.
  externalAuth.process().then(function() {
    assertCallbackPage();
    testAuth.assertSignOut([]);
    return testAuth.process();
  }).then(function() {
    // User should be redirected to success URL.
    testUtil.assertGoTo('http://localhost/home');
  });
}


function testHandleGoogleYoloCredential_upgradeAnonymous_credentialInUse() {
  // Enable googleyolo with Google provider and no additional scopes.
  app.setConfig({
    // Enable anonymous user upgrade.
    'autoUpgradeAnonymousUsers': true,
    'signInSuccessUrl': 'http://localhost/home',
    'signInOptions': [{
      'provider': 'google.com',
      'authMethod': 'https://accounts.google.com',
      'clientId': '1234567890.apps.googleusercontent.com'
    }, 'facebook.com', 'password', 'phone'],
    'credentialHelper':
        firebaseui.auth.widget.Config.CredentialHelper.GOOGLE_YOLO
  });
  var expectedCredential = firebase.auth.GoogleAuthProvider.credential(
      googleYoloIdTokenCredential.idToken);
  // Expected linkWithCredential error.
  var expectedError = {
    'code': 'auth/credential-already-in-use',
    'credential': expectedCredential,
    'email': federatedAccount.getEmail(),
    'message': 'MESSAGE'
  };
  // Expected FirebaseUI error.
  var expectedMergeError = new firebaseui.auth.AuthUIError(
      firebaseui.auth.AuthUIError.Error.MERGE_CONFLICT,
      null,
      expectedCredential);
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  // Simulate anonymous user initially signed in on external Auth instance.
  externalAuth.setUser(anonymousUser);
  // This will resolve with false due to the failing Auth call underneath.
  firebaseui.auth.widget.handler.common.handleGoogleYoloCredential(
      app, component, googleYoloIdTokenCredential)
      .then(function(status) {
        assertFalse(status);
        asyncTestCase.signal();
      });
  // Trigger onAuthStateChanged listener.
  externalAuth.runAuthChangeHandler();
  // Confirm linkWithCredential called underneath with
  // expected error thrown.
  externalAuth.currentUser.assertLinkWithCredential(
      [expectedCredential],
      null,
      expectedError);
  // Confirm signInFailure called with expected error on processing.
  externalAuth.process().then(function() {
    assertNoInfoBarMessage();
    assertSignInFailure(expectedMergeError);
  });
}


function testHandleGoogleYoloCredential_upgradeAnonymous_fedEmailInUse() {
  // Enable googleyolo with Google provider and no additional scopes.
  app.setConfig({
    // Enable anonymous user upgrade.
    'autoUpgradeAnonymousUsers': true,
    'signInSuccessUrl': 'http://localhost/home',
    'signInOptions': [{
      'provider': 'google.com',
      'authMethod': 'https://accounts.google.com',
      'clientId': '1234567890.apps.googleusercontent.com'
    }, 'facebook.com', 'password', 'phone'],
    'credentialHelper':
        firebaseui.auth.widget.Config.CredentialHelper.GOOGLE_YOLO
  });
  var expectedCredential = firebase.auth.GoogleAuthProvider.credential(
      googleYoloIdTokenCredential.idToken);
  // Expected linkWithCredential error.
  var expectedError = {
    'code': 'auth/email-already-in-use',
    'credential': expectedCredential,
    'email': federatedAccount.getEmail(),
    'message': 'MESSAGE'
  };
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(),
      firebase.auth.GoogleAuthProvider.credential(
          googleYoloIdTokenCredential.idToken, null));
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  // Simulate anonymous user initially signed in on external Auth instance.
  externalAuth.setUser(anonymousUser);
  // This will resolve with false due to the failing Auth call underneath.
  firebaseui.auth.widget.handler.common.handleGoogleYoloCredential(
      app, component, googleYoloIdTokenCredential)
      .then(function(status) {
        assertFalse(status);
        asyncTestCase.signal();
      });
  // Trigger onAuthStateChanged listener.
  externalAuth.runAuthChangeHandler();
  // Confirm linkWithCredential called underneath with
  // expected error thrown.
  externalAuth.currentUser.assertLinkWithCredential(
      [expectedCredential],
      null,
      expectedError);
  externalAuth.process().then(function() {
    // No info bar message should be shown and the callback page should be
    // rendered for linking flow.
    assertNoInfoBarMessage();
    assertCallbackPage();
    // Simulate existing email belongs to a Facebook account.
    testAuth.assertFetchSignInMethodsForEmail(
        [federatedAccount.getEmail()], ['facebook.com']);
    return testAuth.process();
  }).then(function() {
    // The pending credential should be saved here.
    assertObjectEquals(
        pendingEmailCred,
        firebaseui.auth.storage.getPendingEmailCredential(app.getAppId()));
    // Federated linking flow should be triggered.
    assertFederatedLinkingPage(federatedAccount.getEmail());
  });
}


function testHandleGoogleYoloCredential_upgradeAnonymous_passEmailInUse() {
  // Enable googleyolo with Google provider and no additional scopes.
  app.setConfig({
    // Enable anonymous user upgrade.
    'autoUpgradeAnonymousUsers': true,
    'signInSuccessUrl': 'http://localhost/home',
    'signInOptions': [{
      'provider': 'google.com',
      'authMethod': 'https://accounts.google.com',
      'clientId': '1234567890.apps.googleusercontent.com'
    }, 'facebook.com', 'password', 'phone'],
    'credentialHelper':
        firebaseui.auth.widget.Config.CredentialHelper.GOOGLE_YOLO
  });
  var expectedCredential = firebase.auth.GoogleAuthProvider.credential(
      googleYoloIdTokenCredential.idToken);
  // Expected linkWithCredential error.
  var expectedError = {
    'code': 'auth/email-already-in-use',
    'credential': expectedCredential,
    'email': federatedAccount.getEmail(),
    'message': 'MESSAGE'
  };
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
      federatedAccount.getEmail(),
      firebase.auth.GoogleAuthProvider.credential(
          googleYoloIdTokenCredential.idToken, null));
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  // Simulate anonymous user initially signed in on external Auth instance.
  externalAuth.setUser(anonymousUser);
  // This will resolve with false due to the failing Auth call underneath.
  firebaseui.auth.widget.handler.common.handleGoogleYoloCredential(
      app, component, googleYoloIdTokenCredential)
      .then(function(status) {
        assertFalse(status);
        asyncTestCase.signal();
      });
  // Trigger onAuthStateChanged listener.
  externalAuth.runAuthChangeHandler();
  // Confirm linkWithCredential called underneath with
  // expected error thrown.
  externalAuth.currentUser.assertLinkWithCredential(
      [expectedCredential],
      null,
      expectedError);
  externalAuth.process().then(function() {
    // No info bar message shown and callback page rendered to complete account
    // linking.
    assertNoInfoBarMessage();
    assertCallbackPage();
    // Simulate email belongs to an existing password account.
    testAuth.assertFetchSignInMethodsForEmail(
        [federatedAccount.getEmail()], ['password']);
    return testAuth.process();
  }).then(function() {
    // The pending email credential should be cleared at this point.
    // Password linking does not require a redirect so no need to save it
    // anyway.
    assertFalse(firebaseui.auth.storage.hasPendingEmailCredential(
        app.getAppId()));
    // Password linking page rendered.
    assertPasswordLinkingPage(federatedAccount.getEmail());
  });
}


function testHandleGoogleYoloCredential_upgradeAnonymous_withScopes() {
  var expectedProvider = firebaseui.auth.idp.getAuthProvider('google.com');
  expectedProvider.addScope('googl1');
  expectedProvider.addScope('googl2');
  expectedProvider.setCustomParameters({
    'prompt': 'select_account',
    'login_hint': federatedAccount.getEmail()
  });
  // Enable googleyolo with Google provider and additional scopes.
  app.setConfig({
    // Enable anonymous user upgrade.
    'autoUpgradeAnonymousUsers': true,
    'signInSuccessUrl': 'http://localhost/home',
    'signInOptions': [{
      'provider': 'google.com',
      'scopes': ['googl1', 'googl2'],
      'customParameters': {'prompt': 'select_account'},
      'authMethod': 'https://accounts.google.com',
      'clientId': '1234567890.apps.googleusercontent.com'
    }, 'facebook.com', 'password', 'phone'],
    'credentialHelper':
        firebaseui.auth.widget.Config.CredentialHelper.GOOGLE_YOLO
  });
  var component = new firebaseui.auth.ui.page.ProviderSignIn(
      goog.nullFunction(), []);
  component.render(container);
  asyncTestCase.waitForSignals(1);
  // Simulate anonymous user initially signed in on the external Auth instance.
  externalAuth.setUser(anonymousUser);
  // This will trigger a linkWithRedirect using the expected provider since
  // additional scopes are requested.
  firebaseui.auth.widget.handler.common.handleGoogleYoloCredential(
      app, component, googleYoloIdTokenCredential)
      .then(function(status) {
        // Remains on same page until redirect completes.
        assertProviderSignInPage();
        assertTrue(status);
        asyncTestCase.signal();
      });
  // Trigger onAuthStateChanged listener.
  externalAuth.runAuthChangeHandler();
  // Confirm linkWithRedirect called on the external Auth instance user.
  externalAuth.currentUser.assertLinkWithRedirect([expectedProvider]);
  testAuth.process();
}


function testSendEmailLinkForSignIn() {
  // Test sign in email link is sent with expected action code settings.
  app.updateConfig('signInOptions', emailLinkSignInOptions);
  var expectedActionCodeSettings = buildActionCodeSettings();
  asyncTestCase.waitForSignals(1);
  var component = new firebaseui.auth.ui.page.Callback();
  component.render(container);
  var onCancelClick = goog.testing.recordFunction();
  firebaseui.auth.widget.handler.common.sendEmailLinkForSignIn(
      app, component, 'user@example.com', onCancelClick, fail);
  testAuth.assertSendSignInLinkToEmail(
      ['user@example.com', expectedActionCodeSettings]);
  testAuth.process().then(function() {
    assertEmailLinkSignInSentPage();
    // Email for email link sign in should be stored.
    assertEquals(
        'user@example.com',
        firebaseui.auth.storage.getEmailForSignIn('SESSIONID', app.getAppId()));
    mockClock.tick(3600000);
    assertFalse(firebaseui.auth.storage.hasEmailForSignIn(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSendEmailLinkForSignIn_linking() {
  // Test pending credential is passed for linking flows.
  var credential = createMockCredential({
    'accessToken': 'facebookAccessToken',
    'providerId': 'facebook.com'
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
     'user@example.com', credential);
  app.updateConfig('signInOptions', emailLinkSignInOptions);
  var expectedActionCodeSettings = buildActionCodeSettings(
      false, pendingEmailCred.getCredential().providerId);
  asyncTestCase.waitForSignals(1);
  var component = new firebaseui.auth.ui.page.Callback();
  component.render(container);
  var onCancelClick = goog.testing.recordFunction();
  firebaseui.auth.widget.handler.common.sendEmailLinkForSignIn(
      app, component, 'user@example.com', onCancelClick, fail,
      pendingEmailCred);
  testAuth.assertSendSignInLinkToEmail(
      ['user@example.com', expectedActionCodeSettings]);
  testAuth.process().then(function() {
    assertEmailLinkSignInSentPage();
    // Email for email link sign in and pending credential to link to should
    // be stored.
    assertEquals(
        'user@example.com',
        firebaseui.auth.storage.getEmailForSignIn('SESSIONID', app.getAppId()));
    assertObjectEquals(
        pendingEmailCred,
        firebaseui.auth.storage.getEncryptedPendingCredential(
            'SESSIONID', app.getAppId()));
    mockClock.tick(3600000);
    assertFalse(firebaseui.auth.storage.hasEmailForSignIn(app.getAppId()));
    assertFalse(
        firebaseui.auth.storage.hasEncryptedPendingCredential(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSendEmailLinkForSignIn_anonymousUpgrade() {
  // Test sign in email link is sent for anonymous upgrade.
  app.updateConfig('signInOptions', emailLinkSignInOptions);
  app.updateConfig('autoUpgradeAnonymousUsers', true);
  // Simulate anonymous current user on external Auth instance.
  externalAuth.setUser(anonymousUser);
  // Anonymous user's uid should be set on the email link.
  var expectedActionCodeSettings = buildActionCodeSettings(
      null, null, anonymousUser['uid']);
  asyncTestCase.waitForSignals(1);
  var component = new firebaseui.auth.ui.page.Callback();
  component.render(container);
  var onCancelClick = goog.testing.recordFunction();
  firebaseui.auth.widget.handler.common.sendEmailLinkForSignIn(
      app, component, 'user@example.com', onCancelClick, fail);
  // Trigger onAuthStateChanged listener.
  externalAuth.runAuthChangeHandler();
  externalAuth.process().then(function() {
    testAuth.assertSendSignInLinkToEmail(
        ['user@example.com', expectedActionCodeSettings]);
    return testAuth.process();
  }).then(function() {
    assertEmailLinkSignInSentPage();
    // Email for email link sign in should be stored.
    assertEquals(
        'user@example.com',
        firebaseui.auth.storage.getEmailForSignIn('SESSIONID', app.getAppId()));
    mockClock.tick(3600000);
    assertFalse(firebaseui.auth.storage.hasEmailForSignIn(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSendEmailLinkForSignIn_anonymousUpgrade_pendingCred() {
  // Test sign in email link is sent with pending credential for anonymous
  // upgrade.
  var credential = createMockCredential({
    'accessToken': 'facebookAccessToken',
    'providerId': 'facebook.com'
  });
  var pendingEmailCred = new firebaseui.auth.PendingEmailCredential(
     'user@example.com', credential);
  app.updateConfig('signInOptions', emailLinkSignInOptions);
  app.updateConfig('autoUpgradeAnonymousUsers', true);
  // Simulate anonymous current user on external Auth instance.
  externalAuth.setUser(anonymousUser);
  // Anonymous user's uid should be set on the email link. Pending credential
  // should also be passed.
  var expectedActionCodeSettings = buildActionCodeSettings(
      false, pendingEmailCred.getCredential().providerId, anonymousUser['uid']);
  asyncTestCase.waitForSignals(1);
  var component = new firebaseui.auth.ui.page.Callback();
  component.render(container);
  var onCancelClick = goog.testing.recordFunction();
  firebaseui.auth.widget.handler.common.sendEmailLinkForSignIn(
      app, component, 'user@example.com', onCancelClick, fail,
      pendingEmailCred);
  // Trigger onAuthStateChanged listener.
  externalAuth.runAuthChangeHandler();
  externalAuth.process().then(function() {
    testAuth.assertSendSignInLinkToEmail(
        ['user@example.com', expectedActionCodeSettings]);
    return testAuth.process();
  }).then(function() {
    assertEmailLinkSignInSentPage();
    // Email for email link sign in and pending credential to link to should
    // be stored.
    assertEquals(
        'user@example.com',
        firebaseui.auth.storage.getEmailForSignIn('SESSIONID', app.getAppId()));
    assertObjectEquals(
        pendingEmailCred,
        firebaseui.auth.storage.getEncryptedPendingCredential(
            'SESSIONID', app.getAppId()));
    mockClock.tick(3600000);
    assertFalse(firebaseui.auth.storage.hasEmailForSignIn(app.getAppId()));
    assertFalse(
        firebaseui.auth.storage.hasEncryptedPendingCredential(app.getAppId()));
    asyncTestCase.signal();
  });
}


function testSendEmailLinkForSignIn_error() {
  // Test error is thrown for sendSignInLinkToEmail.
  app.updateConfig('signInOptions', emailLinkSignInOptions);
  var expectedActionCodeSettings = buildActionCodeSettings();
  asyncTestCase.waitForSignals(1);
  var component = new firebaseui.auth.ui.page.Callback();
  component.render(container);
  var onError = goog.testing.recordFunction();
  firebaseui.auth.widget.handler.common.sendEmailLinkForSignIn(
      app, component, 'user@example.com', fail, onError);
  testAuth.assertSendSignInLinkToEmail(
      ['user@example.com', expectedActionCodeSettings], null, internalError);
  testAuth.process().then(function() {
    // Email for email link sign in should be removed from storage for error
    // cases.
    assertFalse(firebaseui.auth.storage.hasEmailForSignIn(app.getAppId()));
    assertEquals(1, onError.getCallCount());
    assertEquals(internalError, onError.getLastCall().getArgument(0));
    asyncTestCase.signal();
  });
}
