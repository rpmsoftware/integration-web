function Subscription(serviceRootUri, getAccessTokenFn) {
    this._context = new Microsoft.OutlookServices.Extensions.DataContext(serviceRootUri, undefined, getAccessTokenFn);
}

Object.defineProperty(Subscription.prototype, "context", {
    get: function () {
        return this._context;
    },
    enumerable: true,
    configurable: true
});

Subscription.prototype.getPath = function (prop) {
    return this.context.serviceRootUri + '/' + prop;
};

Object.defineProperty(Subscription.prototype, "users", {
    get: function () {
        if (this._Users === undefined) {
            this._Users = new Users(this.context, this.getPath('Users'));
        }
        return this._Users;
    },
    enumerable: true,
    configurable: true
});

/// <summary>
/// There are no comments for Users in the schema.
/// </summary>
Subscription.prototype.addToUsers = function (user) {
    this.users.addUser(user);
};

Object.defineProperty(Subscription.prototype, "me", {
    get: function () {
        if (this._Me === undefined) {
            this._Me = new UserFetcher(this.context, this.getPath("Me"));
        }
        return this._Me;
    },
    enumerable: true,
    configurable: true
});
