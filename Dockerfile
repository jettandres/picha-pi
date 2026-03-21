FROM archlinux:base

ENV TZ=Etc/UTC

RUN pacman -Sy --noconfirm \
    && pacman -S --noconfirm \
        base-devel \
        curl \
        wget \
        git \
        git-lfs \
        vim \
        nano \
        tmux \
        htop \
        tree \
        jq \
        ripgrep \
        fd \
        zip \
        unzip \
        tar \
        openssh \
        sudo \
        python \
        python-pip \
        nodejs \
        npm \
        go \
        docker \
        docker-buildx \
        docker-compose \
        lazygit \
        tk \
        which \
        less \
        bc \
        && git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.14.0 \
        && rm -rf /var/cache/pacman/pkg/*

ENV ASDF_DIR="/root/.asdf"
ENV PATH="${ASDF_DIR}/bin:${ASDF_DIR}/shims:${PATH}"

RUN . "$ASDF_DIR/asdf.sh" \
    && asdf plugin add nodejs \
    && asdf plugin add golang \
    && asdf plugin add python

RUN . "$ASDF_DIR/asdf.sh" \
    && asdf install nodejs latest:22 \
    && asdf install golang latest:1.22 \
    && asdf install python latest:3.12 \
    && asdf global nodejs latest:22 \
    && asdf global golang latest:1.22 \
    && asdf global python latest:3.12

RUN . "$ASDF_DIR/asdf.sh" \
    && python -m pip install --user --upgrade pip \
    && python -m pip install --user \
        black \
        ruff \
        mypy \
        pytest \
        ipython \
        pipx

RUN npm install -g @mariozechner/pi-coding-agent

RUN . "$ASDF_DIR/asdf.sh" \
    && npm install -g \
        pnpm \
        yarn \
        prettier \
        typescript \
        typescript-language-server

RUN curl -LO https://github.com/neovim/neovim/releases/download/v0.10.3/nvim-linux64.tar.gz \
    && tar -xzf nvim-linux64.tar.gz -C /opt \
    && ln -sf /opt/nvim-linux64/bin/nvim /usr/local/bin/nvim \
    && rm nvim-linux64.tar.gz

RUN git clone https://github.com/LazyVim/LazyVim ~/.config/nvim

RUN useradd -m -s /bin/bash -G wheel,docker agent \
    && echo 'agent:agent' | chpasswd \
    && mkdir -p /home/agent \
    && chown -R agent:agent /home/agent

USER agent
WORKDIR /home/agent

ENV BASH_ENV="/etc/bash.bashrc"
RUN cat > /home/agent/.bashrc <<'EOF'
. "$HOME/.asdf/asdf.sh"
export PS1="(agent) \[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "
alias ll='ls -la'
alias la='ls -A'
alias l='ls -CF'
export EDITOR=nvim
export VISUAL=nvim
EOF

RUN chown agent:agent /home/agent/.bashrc

RUN mkdir -p /home/agent/.config/pi \
    && echo '{"permissions": {"allow": ["read", "write", "web-search", "bash"]}}' > /home/agent/.config/pi/permissions.json

USER root
RUN chmod 700 /home/agent/.config/pi

RUN mkdir -p /workspace
RUN chmod 777 /workspace
WORKDIR /workspace

ENV PATH="/root/.local/bin:${PATH}"

CMD ["/bin/bash", "-l"]
