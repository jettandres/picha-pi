FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
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
    fd-find \
    zip \
    unzip \
    tar \
    ca-certificates \
    openssh-client \
    sudo \
    locales \
    tzdata \
    fonts-hack-ttf \
    libssl-dev \
    libffi-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    libncurses-dev \
    libncurses5 \
    libncursesw5 \
    zlib1g-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

RUN curl -LO https://github.com/neovim/neovim/releases/download/v0.10.3/nvim-linux64.tar.gz \
    && tar -xzf nvim-linux64.tar.gz -C /opt \
    && ln -sf /opt/nvim-linux64/bin/nvim /usr/local/bin/nvim \
    && rm nvim-linux64.tar.gz

RUN curl -fsSL https://git.io/lazygit | bash

RUN git clone https://github.com/LazyVim/LazyVim ~/.config/nvim

RUN git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.14.0

ENV ASDF_DIR="/root/.asdf"
ENV PATH="${ASDF_DIR}/bin:${ASDF_DIR}/shims:${PATH}"

RUN . "$ASDF_DIR/asdf.sh" \
    && asdf plugin add nodejs \
    && asdf plugin add golang \
    && asdf plugin add python

ENV ASDF_NODEJS_LEGACY_FILE_Download=true
RUN . "$ASDF_DIR/asdf.sh" \
    && asdf install nodejs latest:22 \
    && asdf install golang latest:1.22 \
    && asdf install python latest:3.12 \
    && asdf global nodejs latest:22 \
    && asdf global golang latest:1.22 \
    && asdf global python latest:3.12

ENV PIP_HOME="/root/.local/share/python-install"
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

RUN apt-get update && apt-get install -y --no-install-recommends \
    docker.io \
    docker-buildx-plugin \
    docker-compose-plugin \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/google-cloud.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/google-cloud.gpg] https://packages.cloud.google.com/apt cloud-sdk main" > /etc/apt/sources.list.d/google-cloud.list \
    && apt-get update && apt-get install -y google-cloud-cli \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash -G sudo,docker agent \
    && echo 'agent:agent' | chpasswd \
    && mkdir -p /home/agent \
    && chown -R agent:agent /home/agent

USER agent
WORKDIR /home/agent

ENV BASH_ENV="/etc/bash.bashrc"
COPY --chown=agent:agent <<-EOF /home/agent/.bashrc
	. "$HOME/.asdf/asdf.sh"
	export PS1="(agent) \[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "
	alias ll='ls -la'
	alias la='ls -A'
	alias l='ls -CF'
	export EDITOR=nvim
	export VISUAL=nvim
EOF

RUN mkdir -p /home/agent/.config/pi \
    && echo '{"permissions": {"allow": ["read", "write", "web-search", "bash"]}}' > /home/agent/.config/pi/permissions.json

USER root
RUN chmod 700 /home/agent/.config/pi

RUN mkdir -p /workspace
RUN chmod 777 /workspace
WORKDIR /workspace

ENV PATH="/root/.local/bin:${PATH}"


CMD ["/bin/bash", "-l"]
