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
        fish \
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

RUN useradd -m -s /usr/bin/fish -G wheel,docker agent \
    && echo 'agent:agent' | chpasswd \
    && mkdir -p /home/agent \
    && chown -R agent:agent /home/agent

USER agent
WORKDIR /home/agent

RUN mkdir -p /home/agent/.config/fish

RUN fish -c "set -U fish_user_paths $HOME/.asdf/bin $HOME/.local/bin $fish_user_paths"

RUN cat > /home/agent/.config/fish/config.fish <<'EOF'
. $HOME/.asdf/asdf.sh
set -gx EDITOR nvim
set -gx VISUAL nvim
alias ll 'ls -la'
alias la 'ls -A'
alias l 'ls -CF'
EOF

RUN chown -R agent:agent /home/agent/.config

RUN mkdir -p /home/agent/.config/pi \
    && echo '{"permissions": {"allow": ["read", "write", "web-search", "bash"]}}' > /home/agent/.config/pi/permissions.json \
    && echo '{"provider": "opencode", "opencode_api_url": "https://opencode.ai/api"}' > /home/agent/.config/pi/config.json

USER root
RUN chmod 700 /home/agent/.config/pi

RUN mkdir -p /workspace
RUN chmod 777 /workspace
WORKDIR /workspace

ENV PATH="/root/.local/bin:${PATH}"
ENV EDITOR=nvim
ENV VISUAL=nvim

CMD ["/usr/bin/fish", "-l"]
