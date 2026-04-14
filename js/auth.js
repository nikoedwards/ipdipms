// ============================================================
// 认证工具层
// ============================================================

const Auth = {
  _user: null,
  _profile: null,

  async getSession() {
    const { data: { session } } = await sb.auth.getSession();
    return session;
  },

  async getUser() {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  },

  // 未登录则跳转到 login.html，返回当前用户
  async requireAuth() {
    const user = await this.getUser();
    if (!user) {
      const redirect = encodeURIComponent(window.location.href);
      window.location.href = `login.html?redirect=${redirect}`;
      return null;
    }
    this._user = user;
    return user;
  },

  async getProfile(userId) {
    const { data } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  },

  async signIn(email, password) {
    return await sb.auth.signInWithPassword({ email, password });
  },

  async signUp(email, password, name) {
    return await sb.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
  },

  async signOut() {
    await sb.auth.signOut();
    window.location.href = 'login.html';
  },

  // 在导航栏右侧注入用户信息 + 登出按钮
  async injectNavUser() {
    const placeholder = document.getElementById('nav-user');
    if (!placeholder) return;

    const user = await this.getUser();
    if (!user) return;

    const profile = await this.getProfile(user.id);
    const displayName = profile?.name || user.email.split('@')[0];
    const initial = displayName.charAt(0).toUpperCase();

    placeholder.innerHTML = `
      <div class="nav-user-wrap">
        <div class="nav-avatar">${initial}</div>
        <span class="nav-username">${displayName}</span>
        <button class="nav-signout" id="signOutBtn">退出</button>
      </div>`;

    document.getElementById('signOutBtn').addEventListener('click', () => Auth.signOut());
  },
};
